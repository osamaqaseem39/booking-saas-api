import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Tournament } from '../entities/tournament.entity';
import { TournamentRegistration } from '../entities/tournament-registration.entity';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { RegisterTeamDto } from '../dto/register-team.dto';
import { TOURNAMENT_ERROR_CODES } from '../types/tournament.types';
import { TournamentAuditService } from './tournament-audit.service';

@Injectable()
export class RegistrationsService {
  constructor(
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
    @InjectRepository(TournamentRegistration)
    private readonly registrations: Repository<TournamentRegistration>,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly members: Repository<TeamMember>,
    private readonly audit: TournamentAuditService,
  ) {}

  async listForTournament(tournamentId: string) {
    return this.registrations.find({
      where: { tournamentId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
  }

  async register(
    tenantId: string,
    tournamentId: string,
    dto: RegisterTeamDto,
    actorId?: string,
    idempotencyKey?: string,
  ) {
    const tournament = await this.tournaments.findOne({
      where: { id: tournamentId, tenantId, deletedAt: IsNull() },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');

    if (tournament.status !== 'registration_open') {
      throw new ForbiddenException({
        code: TOURNAMENT_ERROR_CODES.REGISTRATION_CLOSED,
        message: 'Registration is not open',
      });
    }

    if (idempotencyKey) {
      const existing = await this.registrations.findOne({
        where: { idempotencyKey },
      });
      if (existing) return existing;
    }

    const approvedCount = await this.registrations.count({
      where: { tournamentId, status: 'approved' as const, deletedAt: IsNull() },
    });

    let team: Team;
    if (dto.teamId) {
      const found = await this.teams.findOne({
        where: { id: dto.teamId, tenantId, deletedAt: IsNull() },
      });
      if (!found) throw new NotFoundException('Team not found');
      team = found;
    } else {
      team = await this.teams.save({
        tenantId,
        name: dto.teamName,
      });
      if (dto.members?.length) {
        for (const m of dto.members) {
          await this.members.save({
            teamId: team.id,
            userId: m.userId ?? null,
            displayName: m.displayName ?? null,
            role: m.role,
            jerseyNumber: m.jerseyNumber ?? null,
          });
        }
      }
    }

    const dup = await this.registrations.findOne({
      where: { tournamentId, teamId: team.id, deletedAt: IsNull() },
    });
    if (dup && !['cancelled', 'rejected', 'withdrawn'].includes(dup.status)) {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.TEAM_ALREADY_REGISTERED,
        message: 'Team already registered',
      });
    }

    const atCapacity = approvedCount >= tournament.maxTeams;
    const reg = await this.registrations.save({
      tournamentId,
      teamId: team.id,
      status: atCapacity ? 'waitlisted' : 'pending',
      waitlistPosition: atCapacity ? approvedCount + 1 : null,
      idempotencyKey: idempotencyKey ?? null,
      paymentStatus:
        tournament.entryFeeAmount && Number(tournament.entryFeeAmount) > 0
          ? 'pending'
          : 'paid',
    });

    await this.audit.log({
      tenantId,
      entityType: 'registration',
      entityId: reg.id,
      actorId,
      afterState: { status: reg.status, teamId: team.id },
    });

    return { registration: reg, team };
  }

  async approve(
    tenantId: string,
    registrationId: string,
    actorId?: string,
  ) {
    const reg = await this.findRegistration(tenantId, registrationId);
    reg.status = 'approved';
    reg.approvedAt = new Date();
    reg.version += 1;
    await this.registrations.save(reg);
    await this.audit.log({
      tenantId,
      entityType: 'registration',
      entityId: reg.id,
      actorId,
      afterState: { status: 'approved' },
    });
    return reg;
  }

  async reject(
    tenantId: string,
    registrationId: string,
    reason?: string,
    actorId?: string,
  ) {
    const reg = await this.findRegistration(tenantId, registrationId);
    reg.status = 'rejected';
    reg.rejectedReason = reason ?? null;
    reg.version += 1;
    await this.registrations.save(reg);
    await this.audit.log({
      tenantId,
      entityType: 'registration',
      entityId: reg.id,
      actorId,
      afterState: { status: 'rejected', reason },
    });
    return reg;
  }

  private async findRegistration(tenantId: string, id: string) {
    const reg = await this.registrations.findOne({ where: { id } });
    if (!reg) throw new NotFoundException('Registration not found');
    const tournament = await this.tournaments.findOne({
      where: { id: reg.tournamentId, tenantId },
    });
    if (!tournament) throw new NotFoundException('Registration not found');
    return reg;
  }
}
