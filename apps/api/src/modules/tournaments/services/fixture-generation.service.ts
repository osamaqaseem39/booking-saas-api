import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
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
import type { StructureBlueprint } from '../types/tournament.types';

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
    const teamIds = approved.map((r) => r.teamId);

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
      if (!d.isBye && d.teamId) {
        const match = await manager.save(TournamentMatch, {
          tournamentId: tournament.id,
          stageId: stage.id,
          status: 'draft',
          homeTeamId: d.teamId,
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
