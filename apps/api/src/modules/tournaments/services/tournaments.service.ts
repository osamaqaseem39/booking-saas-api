import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
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
    return this.matches.find({
      where: { tournamentId, deletedAt: IsNull() },
      order: { scheduledAt: 'ASC' },
    });
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
    const result: BracketNode[] = [];
    for (const s of knockoutStages) {
      const nodes = await this.bracketNodes.find({
        where: { stageId: s.id },
        order: { round: 'ASC', slotIndex: 'ASC' },
      });
      result.push(...nodes);
    }
    return result;
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
