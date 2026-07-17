import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Tournament } from '../entities/tournament.entity';
import { TournamentDivision } from '../entities/tournament-division.entity';
import { TournamentRegistration } from '../entities/tournament-registration.entity';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { RegisterTeamDto } from '../dto/register-team.dto';
import { PublicRegisterTeamDto } from '../dto/public-register-team.dto';
import {
  ACTIVE_REGISTRATION_STATUSES,
  TOURNAMENT_ERROR_CODES,
} from '../types/tournament.types';
import { TournamentAuditService } from './tournament-audit.service';

@Injectable()
export class RegistrationsService {
  constructor(
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
    @InjectRepository(TournamentDivision)
    private readonly divisions: Repository<TournamentDivision>,
    @InjectRepository(TournamentRegistration)
    private readonly registrations: Repository<TournamentRegistration>,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly members: Repository<TeamMember>,
    private readonly audit: TournamentAuditService,
  ) {}

  async listForTournament(divisionId: string) {
    const rows = await this.registrations.find({
      where: { divisionId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    if (rows.length === 0) return [];

    const teams = await this.teams.find({
      where: { id: In(rows.map((r) => r.teamId)) },
    });
    const teamNames = new Map(teams.map((t) => [t.id, t.name]));

    return rows.map((r) => ({
      id: r.id,
      tournamentId: r.divisionId,
      teamId: r.teamId,
      teamName: teamNames.get(r.teamId) ?? null,
      status: r.status,
      paymentStatus: r.paymentStatus,
      waitlistPosition: r.waitlistPosition ?? null,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      rejectedReason: r.rejectedReason ?? null,
      contactName:
        ((r.metadata as { contactName?: string } | null)?.contactName) ?? null,
      contactPhone:
        ((r.metadata as { contactPhone?: string } | null)?.contactPhone) ?? null,
      contactEmail:
        ((r.metadata as { contactEmail?: string } | null)?.contactEmail) ??
        null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Unauthenticated public register — tenant resolved from tournament. */
  async registerPublic(
    divisionId: string,
    dto: PublicRegisterTeamDto,
    actorId?: string,
    idempotencyKey?: string,
  ) {
    const { division, event } = await this.findDivisionById(divisionId);
    return this.register(
      event.tenantId,
      divisionId,
      {
        teamName: dto.teamName,
        members: this.membersWithContactCaptain(dto),
      },
      actorId,
      idempotencyKey,
      {
        contactName: dto.contactName.trim(),
        contactPhone: dto.contactPhone.trim(),
        contactEmail: dto.contactEmail?.trim() || null,
        source: 'public',
      },
    );
  }

  async register(
    tenantId: string,
    divisionId: string,
    dto: RegisterTeamDto,
    actorId?: string,
    idempotencyKey?: string,
    metadata?: Record<string, unknown> | null,
  ) {
    const { division, event } = await this.findDivisionContext(
      tenantId,
      divisionId,
    );

    if (division.status !== 'registration_open') {
      throw new ForbiddenException({
        code: TOURNAMENT_ERROR_CODES.REGISTRATION_CLOSED,
        message: 'Registration is not open',
      });
    }

    if (idempotencyKey) {
      const existing = await this.registrations.findOne({
        where: { idempotencyKey },
      });
      if (existing) {
        const team = await this.teams.findOne({
          where: { id: existing.teamId },
        });
        if (team) {
          return this.formatPublicRegistration(existing, team, division, event);
        }
      }
    }

    const activeCount = await this.countActiveRegistrations(divisionId);
    if (activeCount >= division.maxTeams) {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.REGISTRATION_FULL,
        message: 'Tournament is full',
      });
    }

    let team: Team;
    if (dto.teamId) {
      const found = await this.teams.findOne({
        where: { id: dto.teamId, tenantId, deletedAt: IsNull() },
      });
      if (!found) throw new NotFoundException('Team not found');
      team = found;
    } else {
      if (!dto.teamName?.trim()) {
        throw new BadRequestException('teamName is required');
      }
      team = await this.teams.save({
        tenantId,
        name: dto.teamName.trim(),
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
      where: { divisionId, teamId: team.id, deletedAt: IsNull() },
    });
    if (dup && !['cancelled', 'rejected', 'withdrawn'].includes(dup.status)) {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.TEAM_ALREADY_REGISTERED,
        message: 'Team already registered',
      });
    }

    const reg = await this.registrations.save({
      divisionId,
      teamId: team.id,
      status: 'pending',
      waitlistPosition: null,
      idempotencyKey: idempotencyKey ?? null,
      metadata: metadata ?? null,
      paymentStatus:
        division.entryFeeAmount && Number(division.entryFeeAmount) > 0
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

    return this.formatPublicRegistration(reg, team, division, event);
  }

  async approve(
    tenantId: string,
    registrationId: string,
    actorId?: string,
  ) {
    const reg = await this.findRegistration(tenantId, registrationId);
    const division = await this.divisions.findOne({
      where: { id: reg.divisionId, deletedAt: IsNull() },
    });
    if (!division) throw new NotFoundException('Tournament not found');

    const entryFee = Number(division.entryFeeAmount ?? 0);
    if (entryFee > 0 && reg.paymentStatus !== 'paid') {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.PAYMENT_NOT_CONFIRMED,
        message: 'Entry fee must be paid before approval',
      });
    }

    if (reg.status !== 'approved') {
      const approvedCount = await this.registrations.count({
        where: {
          divisionId: reg.divisionId,
          status: 'approved' as const,
          deletedAt: IsNull(),
        },
      });
      if (approvedCount >= division.maxTeams) {
        throw new ConflictException({
          code: TOURNAMENT_ERROR_CODES.REGISTRATION_FULL,
          message: 'Tournament is full',
        });
      }
    }

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

  async markPaid(
    tenantId: string,
    registrationId: string,
    actorId?: string,
  ) {
    return this.updateStaff(
      tenantId,
      registrationId,
      { paymentStatus: 'paid' },
      actorId,
    );
  }

  async reject(
    tenantId: string,
    registrationId: string,
    reason?: string,
    actorId?: string,
  ) {
    return this.updateStaff(
      tenantId,
      registrationId,
      { status: 'rejected', rejectedReason: reason },
      actorId,
    );
  }

  async updateStaff(
    tenantId: string,
    registrationId: string,
    dto: {
      status?: 'pending' | 'approved' | 'rejected' | 'waitlisted';
      paymentStatus?: 'pending' | 'paid';
      rejectedReason?: string;
    },
    actorId?: string,
  ) {
    const reg = await this.findRegistration(tenantId, registrationId);
    const division = await this.divisions.findOne({
      where: { id: reg.divisionId, deletedAt: IsNull() },
    });
    if (!division) throw new NotFoundException('Tournament not found');

    const before = {
      status: reg.status,
      paymentStatus: reg.paymentStatus,
    };

    if (dto.paymentStatus != null && dto.paymentStatus !== reg.paymentStatus) {
      if (!['pending', 'paid'].includes(dto.paymentStatus)) {
        throw new BadRequestException('Invalid payment status');
      }
      reg.paymentStatus = dto.paymentStatus;
    }

    if (dto.status != null && dto.status !== reg.status) {
      if (!['pending', 'approved', 'rejected', 'waitlisted'].includes(dto.status)) {
        throw new BadRequestException('Invalid registration status');
      }

      if (dto.status === 'approved') {
        const entryFee = Number(division.entryFeeAmount ?? 0);
        const paid =
          (dto.paymentStatus ?? reg.paymentStatus) === 'paid';
        if (entryFee > 0 && !paid) {
          throw new ConflictException({
            code: TOURNAMENT_ERROR_CODES.PAYMENT_NOT_CONFIRMED,
            message: 'Entry fee must be paid before approval',
          });
        }
        if (reg.status !== 'approved') {
          const approvedCount = await this.registrations.count({
            where: {
              divisionId: reg.divisionId,
              status: 'approved' as const,
              deletedAt: IsNull(),
            },
          });
          if (approvedCount >= division.maxTeams) {
            throw new ConflictException({
              code: TOURNAMENT_ERROR_CODES.REGISTRATION_FULL,
              message: 'Tournament is full',
            });
          }
        }
        reg.status = 'approved';
        reg.approvedAt = new Date();
        reg.rejectedReason = null;
      } else if (dto.status === 'rejected') {
        reg.status = 'rejected';
        reg.rejectedReason = dto.rejectedReason ?? reg.rejectedReason ?? null;
        reg.approvedAt = null;
      } else if (dto.status === 'pending') {
        reg.status = 'pending';
        reg.approvedAt = null;
        reg.rejectedReason = null;
        reg.waitlistPosition = null;
      } else {
        reg.status = 'waitlisted';
        reg.approvedAt = null;
      }
    } else if (dto.rejectedReason != null && reg.status === 'rejected') {
      reg.rejectedReason = dto.rejectedReason;
    }

    reg.version += 1;
    await this.registrations.save(reg);
    await this.audit.log({
      tenantId,
      entityType: 'registration',
      entityId: reg.id,
      actorId,
      beforeState: before,
      afterState: {
        status: reg.status,
        paymentStatus: reg.paymentStatus,
      },
    });
    return reg;
  }

  async listForUser(userId: string) {
    const memberships = await this.members.find({ where: { userId } });
    if (memberships.length === 0) return { items: [] };

    const teamIds = memberships.map((m) => m.teamId);
    const rows = await this.registrations.find({
      where: { teamId: In(teamIds), deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (rows.length === 0) return { items: [] };

    const divisions = await this.divisions.find({
      where: { id: In(rows.map((r) => r.divisionId)) },
    });
    const dMap = new Map(divisions.map((d) => [d.id, d]));
    const events = await this.tournaments.find({
      where: { id: In(divisions.map((d) => d.tournamentId)) },
    });
    const eMap = new Map(events.map((e) => [e.id, e]));
    const teams = await this.teams.find({
      where: { id: In(rows.map((r) => r.teamId)) },
    });
    const teamNames = new Map(teams.map((t) => [t.id, t.name]));

    return {
      items: rows.map((r) => {
        const d = dMap.get(r.divisionId);
        const e = d ? eMap.get(d.tournamentId) : undefined;
        return {
          id: r.id,
          tournamentId: r.divisionId,
          tournamentName: e?.name ?? null,
          teamId: r.teamId,
          teamName: teamNames.get(r.teamId) ?? null,
          status: r.status,
          paymentStatus: r.paymentStatus,
          sport: d?.sport ?? null,
          startsAt: e?.startsAt.toISOString() ?? null,
          entryFeeAmount:
            d?.entryFeeAmount != null ? Number(d.entryFeeAmount) : null,
          createdAt: r.createdAt.toISOString(),
        };
      }),
    };
  }

  formatPublicRegistration(
    reg: TournamentRegistration,
    team: Team,
    division: TournamentDivision,
    event: Tournament,
  ) {
    const entryFee = Number(division.entryFeeAmount ?? 0);
    const paymentExpiresAt = new Date(
      reg.createdAt.getTime() + 15 * 60_000,
    ).toISOString();
    const meta = (reg.metadata ?? {}) as {
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string | null;
    };
    return {
      registration: {
        id: reg.id,
        tournamentId: reg.divisionId,
        eventId: event.id,
        tenantId: event.tenantId,
        teamId: reg.teamId,
        status: reg.status,
        paymentStatus: reg.paymentStatus,
        waitlistPosition: reg.waitlistPosition ?? null,
        entryFeeAmount: entryFee > 0 ? entryFee : null,
        entryFeeCurrency: division.entryFeeCurrency,
        paymentExpiresAt: entryFee > 0 ? paymentExpiresAt : null,
        contactName: meta.contactName ?? null,
        contactPhone: meta.contactPhone ?? null,
        contactEmail: meta.contactEmail ?? null,
        createdAt: reg.createdAt.toISOString(),
      },
      team: { id: team.id, name: team.name },
    };
  }

  private membersWithContactCaptain(dto: PublicRegisterTeamDto) {
    const members = [...(dto.members ?? [])];
    const hasCaptain = members.some((m) => m.role === 'captain');
    if (!hasCaptain) {
      members.unshift({
        displayName: dto.contactName.trim(),
        role: 'captain',
      });
    }
    return members;
  }

  private countActiveRegistrations(divisionId: string) {
    return this.registrations.count({
      where: {
        divisionId,
        status: In([...ACTIVE_REGISTRATION_STATUSES]),
        deletedAt: IsNull(),
      },
    });
  }

  private async findDivisionById(divisionId: string) {
    const division = await this.divisions.findOne({
      where: { id: divisionId, deletedAt: IsNull() },
    });
    if (!division) throw new NotFoundException('Tournament not found');
    const event = await this.tournaments.findOne({
      where: { id: division.tournamentId, deletedAt: IsNull() },
    });
    if (!event) throw new NotFoundException('Tournament not found');
    return { division, event };
  }

  private async findDivisionContext(tenantId: string, divisionId: string) {
    const { division, event } = await this.findDivisionById(divisionId);
    if (event.tenantId !== tenantId) {
      throw new NotFoundException('Tournament not found');
    }
    return { division, event };
  }

  private async findRegistration(tenantId: string, id: string) {
    const reg = await this.registrations.findOne({ where: { id } });
    if (!reg) throw new NotFoundException('Registration not found');
    await this.findDivisionContext(tenantId, reg.divisionId);
    return reg;
  }
}
