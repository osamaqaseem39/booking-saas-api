import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { BracketNode } from '../entities/bracket-node.entity';
import { GroupMember } from '../entities/group-member.entity';
import { Standing } from '../entities/standing.entity';
import { TournamentFixture } from '../entities/tournament-fixture.entity';
import { TournamentGroup } from '../entities/tournament-group.entity';
import { TournamentMatch } from '../entities/tournament-match.entity';
import { TournamentRegistration } from '../entities/tournament-registration.entity';
import { TournamentStage } from '../entities/tournament-stage.entity';
import { Tournament } from '../entities/tournament.entity';
import { TournamentConfigVersion } from '../entities/tournament-config-version.entity';
import { generateKnockoutBracket } from '../engines/bracket.engine';
import { generateRoundRobinFixtures } from '../engines/fixture.engine';
import {
  DEFAULT_STANDINGS_RULES,
  TOURNAMENT_ERROR_CODES,
  type StandingsRules,
  type StructureBlueprint,
} from '../types/tournament.types';
import {
  pickAdvancingTeams,
  type GroupStandingInput,
} from '../engines/advancement.engine';

@Injectable()
export class FixtureGenerationService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
    @InjectRepository(TournamentStage)
    private readonly stages: Repository<TournamentStage>,
    @InjectRepository(TournamentConfigVersion)
    private readonly configs: Repository<TournamentConfigVersion>,
    @InjectRepository(TournamentRegistration)
    private readonly registrations: Repository<TournamentRegistration>,
    @InjectRepository(TournamentGroup)
    private readonly groups: Repository<TournamentGroup>,
    @InjectRepository(GroupMember)
    private readonly groupMembers: Repository<GroupMember>,
    @InjectRepository(TournamentMatch)
    private readonly matches: Repository<TournamentMatch>,
    @InjectRepository(TournamentFixture)
    private readonly fixtures: Repository<TournamentFixture>,
    @InjectRepository(BracketNode)
    private readonly bracketNodes: Repository<BracketNode>,
    @InjectRepository(Standing)
    private readonly standings: Repository<Standing>,
  ) {}

  async generateStage(
    tournamentId: string,
    stageOrder: number,
  ): Promise<{ stageId: string; matchesCreated: number }> {
    const tournament = await this.tournaments.findOne({
      where: { id: tournamentId, deletedAt: IsNull() },
    });
    if (!tournament?.currentConfigVersionId) {
      throw new Error('Tournament config missing');
    }

    const stage = await this.stages.findOne({
      where: { tournamentId, order: stageOrder },
    });
    if (!stage) throw new Error('Stage not found');

    const config = await this.configs.findOne({
      where: { id: tournament.currentConfigVersionId },
    });
    if (!config) throw new Error('Config not found');

    const blueprint = config.structureBlueprint as StructureBlueprint;
    const approved = await this.registrations.find({
      where: {
        tournamentId,
        status: 'approved' as const,
      },
    });
    let teamIds = approved.map((r) => r.teamId);

    if (stage.stageType === 'knockout' && blueprint.knockout) {
      const prevGroup = await this.stages.findOne({
        where: {
          tournamentId,
          stageType: 'group',
          order: LessThan(stageOrder),
        },
        order: { order: 'DESC' },
      });
      if (prevGroup) {
        await this.assertGroupStageComplete(tournamentId, prevGroup.id);
        teamIds = await this.resolveAdvancingTeamIds(
          tournamentId,
          prevGroup.id,
          blueprint,
          (config.standingsRules as StandingsRules) ?? DEFAULT_STANDINGS_RULES,
        );
        if (teamIds.length < 2) {
          throw new ConflictException({
            code: TOURNAMENT_ERROR_CODES.STAGE_NOT_READY,
            message: 'Not enough teams qualified for knockout',
          });
        }
      }
    }

    let matchesCreated = 0;

    await this.dataSource.transaction(async (manager) => {
      stage.status = 'generating';
      await manager.save(TournamentStage, stage);

      if (stage.stageType === 'group' && blueprint.groups?.length) {
        matchesCreated = await this.generateGroupStage(
          manager,
          tournament,
          stage,
          blueprint,
          teamIds,
        );
      } else if (stage.stageType === 'knockout') {
        matchesCreated = await this.generateKnockoutStage(
          manager,
          tournament,
          stage,
          blueprint,
          teamIds,
        );
      }

      stage.status = 'ready';
      await manager.save(TournamentStage, stage);
    });

    return { stageId: stage.id, matchesCreated };
  }

  async resetStage(
    tournamentId: string,
    stageOrder: number,
  ): Promise<{ stageId: string }> {
    const stage = await this.stages.findOne({
      where: { tournamentId, order: stageOrder },
    });
    if (!stage) throw new ConflictException('Stage not found');
    if (stage.status === 'pending' || stage.status === 'generating') {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.INVALID_STAGE,
        message: 'Stage has not been generated yet',
      });
    }

    const stageMatches = await this.matches.find({
      where: { tournamentId, stageId: stage.id, deletedAt: IsNull() },
    });
    const hasLockedMatch = stageMatches.some((m) =>
      ['approved', 'walkover', 'in_progress', 'completed', 'disputed'].includes(
        m.status,
      ),
    );
    if (hasLockedMatch) {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.BRACKET_LOCKED,
        message: 'Cannot reset a stage after matches have started or finished',
      });
    }

    await this.dataSource.transaction(async (manager) => {
      if (stageMatches.length > 0) {
        const matchIds = stageMatches.map((m) => m.id);
        await manager
          .createQueryBuilder()
          .delete()
          .from(TournamentFixture)
          .where('matchId IN (:...matchIds)', { matchIds })
          .execute();
        await manager.delete(TournamentMatch, {
          tournamentId,
          stageId: stage.id,
        });
      }
      await manager.delete(BracketNode, { stageId: stage.id });
      if (stage.stageType === 'group') {
        const groups = await manager.find(TournamentGroup, {
          where: { stageId: stage.id },
        });
        for (const group of groups) {
          await manager.delete(Standing, { groupId: group.id });
          await manager.delete(GroupMember, { groupId: group.id });
        }
        await manager.delete(TournamentGroup, { stageId: stage.id });
      }
      stage.status = 'pending';
      await manager.save(TournamentStage, stage);
    });

    return { stageId: stage.id };
  }

  private async generateGroupStage(
    manager: DataSource['manager'],
    tournament: Tournament,
    stage: TournamentStage,
    blueprint: StructureBlueprint,
    teamIds: string[],
  ): Promise<number> {
    const groups = blueprint.groups ?? [];
    let idx = 0;
    let count = 0;
    const shuffled = [...teamIds].sort((a, b) => a.localeCompare(b));

    for (const g of groups) {
      const group = await manager.save(TournamentGroup, {
        stageId: stage.id,
        name: g.name,
      });
      const slice = shuffled.slice(idx, idx + g.size);
      idx += g.size;

      for (const teamId of slice) {
        await manager.save(GroupMember, { groupId: group.id, teamId });
        await manager.save(Standing, { groupId: group.id, teamId });
      }

      const fixtures = generateRoundRobinFixtures(slice);
      for (const f of fixtures) {
        const match = await manager.save(TournamentMatch, {
          tournamentId: tournament.id,
          stageId: stage.id,
          groupId: group.id,
          status: 'draft',
          homeTeamId: f.homeTeamId,
          awayTeamId: f.awayTeamId,
        });
        await manager.save(TournamentFixture, {
          stageId: stage.id,
          groupId: group.id,
          round: f.round,
          matchId: match.id,
        });
        count++;
      }
    }
    return count;
  }

  private async generateKnockoutStage(
    manager: DataSource['manager'],
    tournament: Tournament,
    stage: TournamentStage,
    blueprint: StructureBlueprint,
    teamIds: string[],
  ): Promise<number> {
    const bracketSize = blueprint.knockout?.bracketSize ?? teamIds.length;
    const drafts = generateKnockoutBracket(teamIds, bracketSize);
    let count = 0;

    for (const d of drafts) {
      let matchId: string | null = null;
      if (d.round === 1 && !d.isBye && d.teamId && d.awayTeamId) {
        const match = await manager.save(TournamentMatch, {
          tournamentId: tournament.id,
          stageId: stage.id,
          status: 'draft',
          homeTeamId: d.teamId,
          awayTeamId: d.awayTeamId,
        });
        matchId = match.id;
        count++;
      }
      await manager.save(BracketNode, {
        stageId: stage.id,
        round: d.round,
        slotIndex: d.slotIndex,
        teamId: d.teamId ?? null,
        isBye: d.isBye,
        matchId,
      });
    }
    return count;
  }

  private async assertGroupStageComplete(
    tournamentId: string,
    stageId: string,
  ): Promise<void> {
    const open = await this.matches.count({
      where: {
        tournamentId,
        stageId,
        deletedAt: IsNull(),
        status: Not(In(['approved', 'walkover', 'cancelled'])),
      },
    });
    if (open > 0) {
      throw new ConflictException({
        code: TOURNAMENT_ERROR_CODES.STAGE_NOT_READY,
        message: 'Complete all group matches before generating knockout',
      });
    }
  }

  private async resolveAdvancingTeamIds(
    tournamentId: string,
    groupStageId: string,
    blueprint: StructureBlueprint,
    rules: StandingsRules,
  ): Promise<string[]> {
    const grps = await this.groups.find({ where: { stageId: groupStageId } });
    const inputs: GroupStandingInput[] = [];

    for (const g of grps) {
      const members = await this.groupMembers.find({
        where: { groupId: g.id },
      });
      const memberTeamIds = members.map((m) => m.teamId);
      const completed = await this.matches.find({
        where: {
          tournamentId,
          groupId: g.id,
          status: In(['approved', 'walkover']),
          deletedAt: IsNull(),
        },
      });
      const results = completed
        .filter((m) => m.homeTeamId && m.awayTeamId)
        .map((m) => ({
          homeTeamId: m.homeTeamId!,
          awayTeamId: m.awayTeamId!,
          homeScore: m.homeScore ?? 0,
          awayScore: m.awayScore ?? 0,
        }));
      inputs.push({
        groupId: g.id,
        groupName: g.name,
        teamIds: memberTeamIds,
        results,
        rules,
      });
    }

    return pickAdvancingTeams(inputs, blueprint.advancement);
  }

  async buildStagesFromBlueprint(
    tournamentId: string,
    configVersionId: string,
    structureType: string,
  ): Promise<void> {
    const stages: { order: number; name: string; stageType: string }[] = [];

    if (structureType === 'direct_knockout') {
      stages.push({ order: 1, name: 'Knockout', stageType: 'knockout' });
    } else if (structureType === 'group_only') {
      stages.push({ order: 1, name: 'Group Stage', stageType: 'group' });
    } else if (
      structureType === 'group_plus_knockout' ||
      structureType === 'qualifier_group_knockout'
    ) {
      stages.push({ order: 1, name: 'Group Stage', stageType: 'group' });
      stages.push({ order: 2, name: 'Knockout', stageType: 'knockout' });
    } else {
      stages.push({ order: 1, name: 'Stage 1', stageType: 'group' });
      stages.push({ order: 2, name: 'Stage 2', stageType: 'knockout' });
    }

    for (const s of stages) {
      await this.stages.save({
        tournamentId,
        configVersionId,
        order: s.order,
        name: s.name,
        stageType: s.stageType,
        status: 'pending',
      });
    }
  }
}
