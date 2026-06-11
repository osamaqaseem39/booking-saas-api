import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { TournamentStage } from '../entities/tournament-stage.entity';
import { BookingItem } from '../../bookings/entities/booking-item.entity';
import { TournamentMatch } from '../entities/tournament-match.entity';
import { Tournament } from '../entities/tournament.entity';
import { Standing } from '../entities/standing.entity';
import { TournamentGroup } from '../entities/tournament-group.entity';
import {
  ScheduleMatchDto,
  SubmitScoreDto,
  WalkoverMatchDto,
} from '../dto/match-ops.dto';
import { TOURNAMENT_ERROR_CODES } from '../types/tournament.types';
import { assertMatchTransition } from '../state/tournament-state.machine';
import type { MatchStatus } from '../types/tournament.types';
import {
  computeStandings,
  type MatchResultInput,
} from '../engines/standings.engine';
import { DEFAULT_STANDINGS_RULES } from '../types/tournament.types';
import { TournamentAuditService } from './tournament-audit.service';
import { TournamentConfigVersion } from '../entities/tournament-config-version.entity';
import { TournamentMatchBookingService } from './tournament-match-booking.service';
import { normalizeCourtKind } from '../utils/court-kind.util';

const DEFAULT_MATCH_DURATION_MINUTES = 60;

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(TournamentMatch)
    private readonly matches: Repository<TournamentMatch>,
    @InjectRepository(BookingItem)
    private readonly bookingItems: Repository<BookingItem>,
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
    @InjectRepository(Standing)
    private readonly standings: Repository<Standing>,
    @InjectRepository(TournamentGroup)
    private readonly groups: Repository<TournamentGroup>,
    @InjectRepository(TournamentConfigVersion)
    private readonly configs: Repository<TournamentConfigVersion>,
    @InjectRepository(TournamentStage)
    private readonly stages: Repository<TournamentStage>,
    private readonly audit: TournamentAuditService,
    private readonly matchBooking: TournamentMatchBookingService,
  ) {}

  async schedule(
    tenantId: string,
    matchId: string,
    dto: ScheduleMatchDto,
    actorId?: string,
  ) {
    const match = await this.findMatch(tenantId, matchId);
    assertMatchTransition(match.status as MatchStatus, 'scheduled');
    if (
      dto.expectedVersion != null &&
      dto.expectedVersion !== match.version
    ) {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.CONFLICT_RETRY,
      });
    }

    const durationMinutes =
      dto.durationMinutes ?? DEFAULT_MATCH_DURATION_MINUTES;
    const scheduledAt = new Date(dto.scheduledAt);
    const courtKind = normalizeCourtKind(dto.courtKind) ?? dto.courtKind ?? null;
    if (dto.courtId && courtKind) {
      await this.assertNoCourtConflict(
        matchId,
        dto.courtId,
        courtKind,
        scheduledAt,
        durationMinutes,
      );
    }

    match.status = 'scheduled';
    match.scheduledAt = scheduledAt;
    match.venueId = dto.venueId ?? null;
    match.courtKind = courtKind;
    match.courtId = dto.courtId ?? null;
    match.version += 1;
    await this.matches.save(match);

    const tournament = await this.tournaments.findOne({
      where: { id: match.tournamentId, tenantId },
    });
    if (tournament && dto.courtId && courtKind && dto.venueId && actorId) {
      const bookingId = await this.matchBooking.syncCourtHold({
        tenantId,
        match,
        scheduledAt,
        durationMinutes,
        courtKind,
        courtId: dto.courtId,
        venueId: dto.venueId,
        actorId,
        tournamentName: tournament.name,
      });
      if (bookingId) {
        match.metadata = { ...(match.metadata ?? {}), bookingId };
        await this.matches.save(match);
      }
    }
    await this.audit.log({
      tenantId,
      entityType: 'match',
      entityId: matchId,
      actorId,
      afterState: { status: 'scheduled' },
    });
    return match;
  }

  async start(tenantId: string, matchId: string, actorId?: string) {
    const match = await this.findMatch(tenantId, matchId);
    const next: MatchStatus =
      match.status === 'scheduled' ? 'in_progress' : 'in_progress';
    assertMatchTransition(match.status as MatchStatus, next);
    match.status = 'in_progress';
    match.version += 1;
    await this.matches.save(match);
    return match;
  }

  async submitScore(
    tenantId: string,
    matchId: string,
    dto: SubmitScoreDto,
    actorId?: string,
  ) {
    const match = await this.findMatch(tenantId, matchId);
    if (match.status === 'completed' || match.status === 'approved') {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.MATCH_ALREADY_COMPLETED,
      });
    }
    if (dto.homeScore < 0 || dto.awayScore < 0) {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.INVALID_SCORE,
      });
    }
    if (
      dto.expectedVersion != null &&
      dto.expectedVersion !== match.version
    ) {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.CONFLICT_RETRY,
      });
    }
    match.homeScore = dto.homeScore;
    match.awayScore = dto.awayScore;
    match.status = 'completed';
    match.version += 1;
    await this.matches.save(match);

    if (match.groupId) {
      await this.recomputeGroupStandings(match.groupId, tenantId);
    }

    await this.audit.log({
      tenantId,
      entityType: 'match',
      entityId: matchId,
      actorId,
      afterState: {
        homeScore: dto.homeScore,
        awayScore: dto.awayScore,
        status: 'completed',
      },
    });
    return match;
  }

  async approveResult(tenantId: string, matchId: string, actorId?: string) {
    const match = await this.findMatch(tenantId, matchId);
    assertMatchTransition(match.status as MatchStatus, 'approved');
    match.status = 'approved';
    match.version += 1;
    await this.matches.save(match);
    if (match.groupId) {
      await this.recomputeGroupStandings(match.groupId, tenantId);
    }
    await this.tryCompleteGroupStage(match.stageId, match.tournamentId);
    return match;
  }

  async walkover(
    tenantId: string,
    matchId: string,
    dto: WalkoverMatchDto,
    actorId?: string,
  ) {
    const match = await this.findMatch(tenantId, matchId);
    assertMatchTransition(match.status as MatchStatus, 'walkover');
    const isHome = match.homeTeamId === dto.winnerTeamId;
    const isAway = match.awayTeamId === dto.winnerTeamId;
    if (!isHome && !isAway) {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.INVALID_SCORE,
        message: 'Winner must be a participant',
      });
    }
    match.homeScore = isHome ? 3 : 0;
    match.awayScore = isAway ? 3 : 0;
    match.status = 'walkover';
    match.metadata = { ...(match.metadata ?? {}), walkoverReason: dto.reason };
    match.version += 1;
    await this.matches.save(match);
    if (match.groupId) {
      await this.recomputeGroupStandings(match.groupId, tenantId);
    }
    await this.tryCompleteGroupStage(match.stageId, match.tournamentId);
    return match;
  }

  private async tryCompleteGroupStage(
    stageId: string,
    tournamentId: string,
  ): Promise<void> {
    const stage = await this.stages.findOne({ where: { id: stageId } });
    if (!stage || stage.stageType !== 'group' || stage.status === 'completed') {
      return;
    }
    const open = await this.matches.count({
      where: {
        tournamentId,
        stageId,
        deletedAt: IsNull(),
        status: Not(In(['approved', 'walkover', 'cancelled'])),
      },
    });
    if (open === 0) {
      stage.status = 'completed';
      await this.stages.save(stage);
    }
  }

  private async recomputeGroupStandings(groupId: string, tenantId: string) {
    const group = await this.groups.findOne({ where: { id: groupId } });
    if (!group) return;

    const members = await this.standings.find({ where: { groupId } });
    const teamIds = members.map((m) => m.teamId);

    const completed = await this.matches.find({
      where: {
        groupId,
        status: 'approved' as const,
        deletedAt: IsNull(),
      },
    });

    const tournament = await this.tournaments.findOne({
      where: { id: completed[0]?.tournamentId },
    });
    let rules = DEFAULT_STANDINGS_RULES;
    if (tournament?.currentConfigVersionId) {
      const cfg = await this.configs.findOne({
        where: { id: tournament.currentConfigVersionId },
      });
      if (cfg?.standingsRules) rules = cfg.standingsRules;
    }

    const results: MatchResultInput[] = completed
      .filter((m) => m.homeTeamId && m.awayTeamId)
      .map((m) => ({
        homeTeamId: m.homeTeamId!,
        awayTeamId: m.awayTeamId!,
        homeScore: m.homeScore ?? 0,
        awayScore: m.awayScore ?? 0,
      }));

    const computed = computeStandings(teamIds, results, rules);
    for (const row of computed) {
      await this.standings.update(
        { groupId, teamId: row.teamId },
        {
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          points: row.points,
          rank: row.rank ?? null,
        },
      );
    }
  }

  private async assertNoCourtConflict(
    matchId: string,
    courtId: string,
    courtKind: string,
    start: Date,
    durationMinutes: number,
  ): Promise<void> {
    const end = new Date(start.getTime() + durationMinutes * 60_000);

    const bookingOverlap = await this.bookingItems
      .createQueryBuilder('i')
      .innerJoin('i.booking', 'b')
      .where('i.courtKind = :courtKind', { courtKind })
      .andWhere('i.courtId = :courtId', { courtId })
      .andWhere("i.itemStatus <> 'cancelled'")
      .andWhere("b.bookingStatus NOT IN ('cancelled', 'no_show', 'completed')")
      .andWhere('i.startDatetime < :end', { end: end.toISOString() })
      .andWhere('i.endDatetime > :start', { start: start.toISOString() })
      .getCount();

    if (bookingOverlap > 0) {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.COURT_CONFLICT,
        message: 'Court is already booked for this time',
      });
    }

    const otherMatches = await this.matches.find({
      where: {
        courtId,
        courtKind,
        id: Not(matchId),
        deletedAt: IsNull(),
        status: Not('cancelled' as const),
      },
    });

    const startMs = start.getTime();
    const endMs = end.getTime();
    for (const other of otherMatches) {
      if (!other.scheduledAt) continue;
      const otherStart = other.scheduledAt.getTime();
      const otherEnd = otherStart + durationMinutes * 60_000;
      if (otherStart < endMs && otherEnd > startMs) {
        throw new ConflictException({
          code: TOURNAMENT_ERROR_CODES.COURT_CONFLICT,
          message: 'Another tournament match is scheduled on this court',
        });
      }
    }
  }

  private async findMatch(tenantId: string, matchId: string) {
    const match = await this.matches.findOne({
      where: { id: matchId, deletedAt: IsNull() },
    });
    if (!match) throw new NotFoundException('Match not found');
    const tournament = await this.tournaments.findOne({
      where: { id: match.tournamentId, tenantId },
    });
    if (!tournament) throw new NotFoundException('Match not found');
    return match;
  }
}
