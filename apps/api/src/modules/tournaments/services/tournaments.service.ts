import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Tournament } from '../entities/tournament.entity';
import { TournamentConfigVersion } from '../entities/tournament-config-version.entity';
import { TournamentStage } from '../entities/tournament-stage.entity';
import { TournamentMatch } from '../entities/tournament-match.entity';
import { TournamentFixture } from '../entities/tournament-fixture.entity';
import { BracketNode } from '../entities/bracket-node.entity';
import { Standing } from '../entities/standing.entity';
import { TournamentGroup } from '../entities/tournament-group.entity';
import { GroupMember } from '../entities/group-member.entity';
import { Team } from '../entities/team.entity';
import { TournamentRegistration } from '../entities/tournament-registration.entity';
import { BusinessLocation } from '../../businesses/entities/business-location.entity';
import {
  CreateTournamentDto,
  PreviewStructureDto,
  UpdateTournamentDto,
} from '../dto/create-tournament.dto';
import {
  DEFAULT_STANDINGS_RULES,
  TOURNAMENT_ERROR_CODES,
  type TournamentStatus,
} from '../types/tournament.types';
import { previewStructure, TOURNAMENT_TEMPLATES } from '../engines/structure.engine';
import {
  assertTournamentTransition,
  tournamentEventToStatus,
} from '../state/tournament-state.machine';
import { TournamentAuditService } from './tournament-audit.service';
import { FixtureGenerationService } from './fixture-generation.service';

export type TournamentRow = {
  id: string;
  tenantId: string;
  name: string;
  sport: string;
  venueIds: string[];
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  startsAt: string;
  endsAt: string | null;
  maxTeams: number;
  entryFeeAmount: number | null;
  entryFeeCurrency: string;
  prizePool: Record<string, unknown> | null;
  rules: string | null;
  structureType: string;
  status: string;
  currentConfigVersionId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  structureBlueprint?: unknown;
};

@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
    @InjectRepository(TournamentConfigVersion)
    private readonly configs: Repository<TournamentConfigVersion>,
    @InjectRepository(TournamentStage)
    private readonly stages: Repository<TournamentStage>,
    @InjectRepository(TournamentMatch)
    private readonly matches: Repository<TournamentMatch>,
    @InjectRepository(TournamentFixture)
    private readonly fixtures: Repository<TournamentFixture>,
    @InjectRepository(BracketNode)
    private readonly bracketNodes: Repository<BracketNode>,
    @InjectRepository(Standing)
    private readonly standings: Repository<Standing>,
    @InjectRepository(TournamentGroup)
    private readonly groups: Repository<TournamentGroup>,
    @InjectRepository(GroupMember)
    private readonly groupMembers: Repository<GroupMember>,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    @InjectRepository(TournamentRegistration)
    private readonly registrations: Repository<TournamentRegistration>,
    @InjectRepository(BusinessLocation)
    private readonly locations: Repository<BusinessLocation>,
    private readonly audit: TournamentAuditService,
    private readonly fixtureGen: FixtureGenerationService,
  ) {}

  private toRow(t: Tournament, blueprint?: unknown): TournamentRow {
    return {
      id: t.id,
      tenantId: t.tenantId,
      name: t.name,
      sport: t.sport,
      venueIds: t.venueIds ?? [],
      registrationOpensAt: t.registrationOpensAt?.toISOString() ?? null,
      registrationClosesAt: t.registrationClosesAt?.toISOString() ?? null,
      startsAt: t.startsAt.toISOString(),
      endsAt: t.endsAt?.toISOString() ?? null,
      maxTeams: t.maxTeams,
      entryFeeAmount: t.entryFeeAmount != null ? Number(t.entryFeeAmount) : null,
      entryFeeCurrency: t.entryFeeCurrency,
      prizePool: (t.prizePool as Record<string, unknown>) ?? null,
      rules: t.rules ?? null,
      structureType: t.structureType,
      status: t.status,
      currentConfigVersionId: t.currentConfigVersionId ?? null,
      version: t.version,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      structureBlueprint: blueprint,
    };
  }

  async list(tenantId: string): Promise<TournamentRow[]> {
    const rows = await this.tournaments.find({
      where: { tenantId, deletedAt: IsNull() },
      order: { startsAt: 'DESC' },
    });
    return rows.map((t) => this.toRow(t));
  }

  async get(tenantId: string, id: string): Promise<TournamentRow> {
    const t = await this.findTournament(tenantId, id);
    let blueprint: unknown;
    if (t.currentConfigVersionId) {
      const cfg = await this.configs.findOne({
        where: { id: t.currentConfigVersionId },
      });
      blueprint = cfg?.structureBlueprint;
    }
    return this.toRow(t, blueprint);
  }

  async create(
    tenantId: string,
    dto: CreateTournamentDto,
    actorId?: string,
  ): Promise<TournamentRow> {
    const blueprint = previewStructure({
      teamCount: dto.maxTeams,
      structureType: dto.structureType,
      advancement: dto.advancement,
      groupCount: dto.groupCount,
    });

    const tournament = await this.tournaments.save({
      tenantId,
      name: dto.name,
      sport: dto.sport,
      venueIds: dto.venueIds,
      registrationOpensAt: dto.registrationOpensAt
        ? new Date(dto.registrationOpensAt)
        : null,
      registrationClosesAt: dto.registrationClosesAt
        ? new Date(dto.registrationClosesAt)
        : null,
      startsAt: new Date(dto.startsAt),
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      maxTeams: dto.maxTeams,
      entryFeeAmount:
        dto.entryFeeAmount != null ? String(dto.entryFeeAmount) : null,
      entryFeeCurrency: dto.entryFeeCurrency ?? 'PKR',
      prizePool: dto.prizePool ?? null,
      rules: dto.rules ?? null,
      structureType: dto.structureType,
      status: 'draft',
    });

    const config = await this.configs.save({
      tournamentId: tournament.id,
      version: 1,
      structureBlueprint: blueprint,
      standingsRules: DEFAULT_STANDINGS_RULES,
      seedingMode: 'ranking',
      advancementRules: dto.advancement ? [dto.advancement] : [],
    });

    tournament.currentConfigVersionId = config.id;
    await this.tournaments.save(tournament);

    await this.fixtureGen.buildStagesFromBlueprint(
      tournament.id,
      config.id,
      dto.structureType,
    );

    await this.audit.log({
      tenantId,
      entityType: 'tournament',
      entityId: tournament.id,
      actorId,
      afterState: { status: 'draft', name: tournament.name },
    });

    return this.get(tenantId, tournament.id);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateTournamentDto,
    actorId?: string,
  ): Promise<TournamentRow> {
    const t = await this.findTournament(tenantId, id);
    if (t.status !== 'draft') {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.TOURNAMENT_INVALID_STATE,
        message: 'Only draft tournaments can be edited',
      });
    }
    if (dto.version != null && dto.version !== t.version) {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.CONFLICT_RETRY,
        message: 'Version conflict',
      });
    }

    const before = { ...t };
    if (dto.name != null) t.name = dto.name;
    if (dto.sport != null) t.sport = dto.sport;
    if (dto.venueIds != null) t.venueIds = dto.venueIds;
    if (dto.registrationOpensAt != null)
      t.registrationOpensAt = new Date(dto.registrationOpensAt);
    if (dto.registrationClosesAt != null)
      t.registrationClosesAt = new Date(dto.registrationClosesAt);
    if (dto.startsAt != null) t.startsAt = new Date(dto.startsAt);
    if (dto.endsAt != null) t.endsAt = new Date(dto.endsAt);
    if (dto.maxTeams != null) t.maxTeams = dto.maxTeams;
    if (dto.entryFeeAmount != null)
      t.entryFeeAmount = String(dto.entryFeeAmount);
    if (dto.rules != null) t.rules = dto.rules;
    if (dto.prizePool != null) t.prizePool = dto.prizePool;
    t.version += 1;
    await this.tournaments.save(t);

    await this.audit.log({
      tenantId,
      entityType: 'tournament',
      entityId: id,
      actorId,
      beforeState: before as unknown as Record<string, unknown>,
      afterState: t as unknown as Record<string, unknown>,
    });

    return this.get(tenantId, id);
  }

  private async assertTournamentReadyToComplete(tournamentId: string): Promise<void> {
    const incompleteStages = await this.stages.count({
      where: {
        tournamentId,
        deletedAt: IsNull(),
        status: Not(In(['completed', 'cancelled'])),
      },
    });
    if (incompleteStages > 0) {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.STAGE_NOT_READY,
        message:
          'All tournament stages must be completed before finishing the tournament',
      });
    }

    const openMatches = await this.matches.count({
      where: {
        tournamentId,
        deletedAt: IsNull(),
        status: Not(In(['approved', 'walkover', 'cancelled'])),
      },
    });
    if (openMatches > 0) {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.STAGE_NOT_READY,
        message:
          'All matches must be approved, walkovers, or cancelled before finishing',
      });
    }
  }

  async transition(
    tenantId: string,
    id: string,
    event: string,
    actorId?: string,
  ): Promise<TournamentRow> {
    const t = await this.findTournament(tenantId, id);
    const next = tournamentEventToStatus(event);
    if (!next) {
      throw new ConflictException('Unknown transition event');
    }
    assertTournamentTransition(t.status as TournamentStatus, next);

    if (event === 'complete') {
      await this.assertTournamentReadyToComplete(id);
    }

    if (event === 'start') {
      const config = await this.configs.findOne({
        where: { id: t.currentConfigVersionId! },
      });
      if (config && !config.lockedAt) {
        config.lockedAt = new Date();
        config.lockedByUserId = actorId ?? null;
        await this.configs.save(config);
      }
    }

    const before = t.status;
    t.status = next;
    t.version += 1;
    await this.tournaments.save(t);

    await this.audit.log({
      tenantId,
      entityType: 'tournament',
      entityId: id,
      actorId,
      reason: event,
      beforeState: { status: before },
      afterState: { status: next },
    });

    return this.get(tenantId, id);
  }

  previewStructure(dto: PreviewStructureDto) {
    return previewStructure({
      teamCount: dto.teamCount,
      structureType: dto.structureType,
      advancement: dto.advancement,
      groupCount: dto.groupCount,
    });
  }

  getTemplates() {
    return TOURNAMENT_TEMPLATES;
  }

  async generateStage(tenantId: string, id: string, stageOrder: number) {
    await this.findTournament(tenantId, id);
    return this.fixtureGen.generateStage(id, stageOrder);
  }

  async getStages(tenantId: string, tournamentId: string) {
    await this.findTournament(tenantId, tournamentId);
    return this.stages.find({
      where: { tournamentId, deletedAt: IsNull() },
      order: { order: 'ASC' },
    });
  }

  async getFixtures(tenantId: string, tournamentId: string) {
    await this.findTournament(tenantId, tournamentId);
    const stageList = await this.stages.find({ where: { tournamentId } });
    const stageIds = stageList.map((s) => s.id);
    if (stageIds.length === 0) return [];
    return this.fixtures
      .createQueryBuilder('f')
      .where('f.stageId IN (:...stageIds)', { stageIds })
      .orderBy('f.round', 'ASC')
      .getMany();
  }

  async getMatches(tenantId: string, tournamentId: string) {
    await this.findTournament(tenantId, tournamentId);
    const rows = await this.matches.find({
      where: { tournamentId, deletedAt: IsNull() },
      order: { scheduledAt: 'ASC' },
    });
    const teamIds = new Set<string>();
    for (const m of rows) {
      if (m.homeTeamId) teamIds.add(m.homeTeamId);
      if (m.awayTeamId) teamIds.add(m.awayTeamId);
    }
    const teams =
      teamIds.size > 0
        ? await this.teams.find({ where: { id: In([...teamIds]) } })
        : [];
    const teamNames = new Map(teams.map((t) => [t.id, t.name]));

    return rows.map((m) => ({
      id: m.id,
      tournamentId: m.tournamentId,
      stageId: m.stageId,
      groupId: m.groupId ?? null,
      status: m.status,
      scheduledAt: m.scheduledAt?.toISOString() ?? null,
      venueId: m.venueId ?? null,
      courtKind: m.courtKind ?? null,
      courtId: m.courtId ?? null,
      homeTeamId: m.homeTeamId ?? null,
      awayTeamId: m.awayTeamId ?? null,
      homeTeamName: m.homeTeamId
        ? (teamNames.get(m.homeTeamId) ?? null)
        : null,
      awayTeamName: m.awayTeamId
        ? (teamNames.get(m.awayTeamId) ?? null)
        : null,
      homeScore: m.homeScore ?? null,
      awayScore: m.awayScore ?? null,
      version: m.version,
    }));
  }

  async getStandings(tenantId: string, tournamentId: string) {
    await this.findTournament(tenantId, tournamentId);
    const stageList = await this.stages.find({
      where: { tournamentId, stageType: 'group' },
    });
    const out: { groupId: string; groupName: string; standings: Standing[] }[] =
      [];
    for (const stage of stageList) {
      const grps = await this.groups.find({ where: { stageId: stage.id } });
      for (const g of grps) {
        const rows = await this.standings.find({
          where: { groupId: g.id },
          order: { rank: 'ASC', points: 'DESC' },
        });
        out.push({ groupId: g.id, groupName: g.name, standings: rows });
      }
    }
    return out;
  }

  async getBracket(tenantId: string, tournamentId: string) {
    await this.findTournament(tenantId, tournamentId);
    const knockoutStages = await this.stages.find({
      where: { tournamentId, stageType: 'knockout' },
    });
    const nodes: BracketNode[] = [];
    for (const s of knockoutStages) {
      const stageNodes = await this.bracketNodes.find({
        where: { stageId: s.id },
        order: { round: 'ASC', slotIndex: 'ASC' },
      });
      nodes.push(...stageNodes);
    }

    const teamIds = [
      ...new Set(
        nodes.map((n) => n.teamId).filter((id): id is string => Boolean(id)),
      ),
    ];
    const teams =
      teamIds.length > 0
        ? await this.teams.find({ where: { id: In(teamIds) } })
        : [];
    const teamNames = new Map(teams.map((t) => [t.id, t.name]));

    return nodes.map((n) => ({
      id: n.id,
      stageId: n.stageId,
      round: n.round,
      slotIndex: n.slotIndex,
      parentNodeId: n.parentNodeId ?? null,
      teamId: n.teamId ?? null,
      teamName: n.teamId ? (teamNames.get(n.teamId) ?? null) : null,
      isBye: n.isBye,
      winnerAdvancesToNodeId: n.winnerAdvancesToNodeId ?? null,
      matchId: n.matchId ?? null,
      bracketVersion: n.bracketVersion,
    }));
  }

  async listPublic(
    tenantId: string,
    opts?: { sport?: string; status?: string; page?: number; limit?: number },
  ) {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(50, Math.max(1, opts?.limit ?? 20));
    const defaultStatuses = ['registration_open', 'in_progress', 'published'];
    const statuses = opts?.status
      ? opts.status.split(',').map((s) => s.trim()).filter(Boolean)
      : defaultStatuses;

    const qb = this.tournaments
      .createQueryBuilder('t')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.deletedAt IS NULL')
      .andWhere('t.status IN (:...statuses)', { statuses });

    if (opts?.sport?.trim()) {
      qb.andWhere('t.sport = :sport', { sport: opts.sport.trim() });
    }

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('t.startsAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const items = await Promise.all(
      rows.map((t) => this.toPublicSummary(t)),
    );
    return { items, page, limit, total };
  }

  async getPublic(tenantId: string, id: string) {
    const t = await this.findTournament(tenantId, id);
    const summary = await this.toPublicSummary(t);
    const stageRows = await this.stages.find({
      where: { tournamentId: id, deletedAt: IsNull() },
      order: { order: 'ASC' },
    });
    return {
      ...summary,
      stages: stageRows.map((s) => ({
        id: s.id,
        order: s.order,
        name: s.name,
        stageType: s.stageType,
        status: s.status,
      })),
    };
  }

  private async toPublicSummary(t: Tournament) {
    const approvedTeamsCount = await this.registrations.count({
      where: { tournamentId: t.id, status: 'approved' as const, deletedAt: IsNull() },
    });
    const venueNames: string[] = [];
    if (t.venueIds?.length) {
      const locs = await this.locations.find({
        where: { id: In(t.venueIds) },
        select: ['id', 'name'],
      });
      venueNames.push(...locs.map((l) => l.name));
    }
    return {
      id: t.id,
      name: t.name,
      sport: t.sport,
      status: t.status,
      venueIds: t.venueIds ?? [],
      venueNames,
      registrationOpensAt: t.registrationOpensAt?.toISOString() ?? null,
      registrationClosesAt: t.registrationClosesAt?.toISOString() ?? null,
      startsAt: t.startsAt.toISOString(),
      endsAt: t.endsAt?.toISOString() ?? null,
      maxTeams: t.maxTeams,
      approvedTeamsCount,
      spotsRemaining: Math.max(0, t.maxTeams - approvedTeamsCount),
      entryFeeAmount:
        t.entryFeeAmount != null ? Number(t.entryFeeAmount) : null,
      entryFeeCurrency: t.entryFeeCurrency,
      structureType: t.structureType,
      rules: t.rules ?? null,
      prizePool: (t.prizePool as Record<string, unknown>) ?? null,
    };
  }

  async getPublicStandings(tenantId: string, tournamentId: string) {
    await this.findTournament(tenantId, tournamentId);
    const raw = await this.getStandings(tenantId, tournamentId);
    const teamIds = new Set<string>();
    for (const g of raw) {
      for (const s of g.standings) teamIds.add(s.teamId);
    }
    const teams =
      teamIds.size > 0
        ? await this.teams.find({ where: { id: In([...teamIds]) } })
        : [];
    const teamNames = new Map(teams.map((t) => [t.id, t.name]));

    return raw.map((g) => ({
      groupId: g.groupId,
      groupName: g.groupName,
      standings: g.standings.map((s) => ({
        teamId: s.teamId,
        teamName: teamNames.get(s.teamId) ?? null,
        played: s.played,
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
        goalsFor: s.goalsFor,
        goalsAgainst: s.goalsAgainst,
        goalDifference: s.goalsFor - s.goalsAgainst,
        points: s.points,
        rank: s.rank ?? null,
      })),
    }));
  }

  async getPublicBracket(tenantId: string, tournamentId: string) {
    await this.findTournament(tenantId, tournamentId);
    const knockoutStages = await this.stages.find({
      where: { tournamentId, stageType: 'knockout', deletedAt: IsNull() },
      order: { order: 'ASC' },
    });

    const matchIds = new Set<string>();
    const stagesOut: {
      stageId: string;
      stageName: string;
      nodes: unknown[];
    }[] = [];

    for (const stage of knockoutStages) {
      const nodes = await this.bracketNodes.find({
        where: { stageId: stage.id },
        order: { round: 'ASC', slotIndex: 'ASC' },
      });
      for (const n of nodes) {
        if (n.matchId) matchIds.add(n.matchId);
      }

      const teamIds = [
        ...new Set(nodes.map((n) => n.teamId).filter(Boolean) as string[]),
      ];
      const teams =
        teamIds.length > 0
          ? await this.teams.find({ where: { id: In(teamIds) } })
          : [];
      const teamNames = new Map(teams.map((t) => [t.id, t.name]));

      stagesOut.push({
        stageId: stage.id,
        stageName: stage.name,
        nodes: nodes.map((n) => ({
          id: n.id,
          round: n.round,
          slotIndex: n.slotIndex,
          matchId: n.matchId ?? null,
          homeTeamId: n.teamId ?? null,
          awayTeamId: null,
          homeTeamName: n.teamId ? (teamNames.get(n.teamId) ?? null) : null,
          awayTeamName: null,
          winnerTeamId: null,
          nextNodeId: n.winnerAdvancesToNodeId ?? null,
        })),
      });
    }

    if (matchIds.size > 0) {
      const matches = await this.matches.find({
        where: { id: In([...matchIds]) },
      });
      const matchMap = new Map(matches.map((m) => [m.id, m]));
      for (const stage of stagesOut) {
        for (const node of stage.nodes as Array<Record<string, unknown>>) {
          const match = node.matchId
            ? matchMap.get(node.matchId as string)
            : null;
          if (match) {
            node.homeTeamId = match.homeTeamId;
            node.awayTeamId = match.awayTeamId;
            node.homeTeamName = null;
            node.awayTeamName = null;
          }
        }
      }
    }

    return { stages: stagesOut };
  }

  private async findTournament(
    tenantId: string,
    id: string,
  ): Promise<Tournament> {
    const t = await this.tournaments.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!t) {
      throw new NotFoundException('Tournament not found');
    }
    return t;
  }
}
