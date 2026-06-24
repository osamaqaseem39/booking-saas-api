import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Not, Repository } from 'typeorm';
import { BracketNode } from '../entities/bracket-node.entity';
import { TournamentMatch } from '../entities/tournament-match.entity';
import { TournamentStage } from '../entities/tournament-stage.entity';
import { Tournament } from '../entities/tournament.entity';
import { resolveMatchWinner } from '../engines/knockout-result.engine';

@Injectable()
export class KnockoutBracketService {
  constructor(
    @InjectRepository(BracketNode)
    private readonly bracketNodes: Repository<BracketNode>,
    @InjectRepository(TournamentMatch)
    private readonly matches: Repository<TournamentMatch>,
    @InjectRepository(TournamentStage)
    private readonly stages: Repository<TournamentStage>,
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
  ) {}

  async advanceFromMatch(
    match: TournamentMatch,
    manager?: EntityManager,
  ): Promise<void> {
    const winnerId = resolveMatchWinner(match);
    if (!winnerId) return;

    const nodes = manager
      ? await manager.find(BracketNode, { where: { matchId: match.id } })
      : await this.bracketNodes.find({ where: { matchId: match.id } });
    if (nodes.length === 0) return;

    for (const node of nodes) {
      await this.advanceWinner(
        match.tournamentId,
        match.stageId,
        node,
        winnerId,
        manager,
      );
    }
  }

  async advanceByeNode(
    stageId: string,
    tournamentId: string,
    node: BracketNode,
    teamId: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.advanceWinner(tournamentId, stageId, node, teamId, manager);
  }

  async tryCompleteKnockoutStage(
    stageId: string,
    tournamentId: string,
  ): Promise<void> {
    const stage = await this.stages.findOne({ where: { id: stageId } });
    if (!stage || stage.stageType !== 'knockout' || stage.status === 'completed') {
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
    if (open > 0) return;

    const playable = await this.matches.count({
      where: { tournamentId, stageId, deletedAt: IsNull() },
    });
    if (playable === 0) return;

    stage.status = 'completed';
    await this.stages.save(stage);
    await this.tryAutoCompleteTournament(tournamentId);
  }

  private async advanceWinner(
    tournamentId: string,
    stageId: string,
    sourceNode: BracketNode,
    winnerTeamId: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (!sourceNode.winnerAdvancesToNodeId) return;

    const parent = manager
      ? await manager.findOne(BracketNode, {
          where: { id: sourceNode.winnerAdvancesToNodeId },
        })
      : await this.bracketNodes.findOne({
          where: { id: sourceNode.winnerAdvancesToNodeId },
        });
    if (!parent) return;

    const isHomeFeeder = sourceNode.slotIndex % 2 === 0;

    if (!parent.matchId) {
      const match = manager
        ? await manager.save(TournamentMatch, {
            tournamentId,
            stageId,
            status: 'draft',
            homeTeamId: isHomeFeeder ? winnerTeamId : null,
            awayTeamId: isHomeFeeder ? null : winnerTeamId,
          })
        : await this.matches.save({
            tournamentId,
            stageId,
            status: 'draft',
            homeTeamId: isHomeFeeder ? winnerTeamId : null,
            awayTeamId: isHomeFeeder ? null : winnerTeamId,
          });
      parent.matchId = match.id;
      parent.teamId = match.homeTeamId ?? winnerTeamId;
      if (manager) {
        await manager.save(BracketNode, parent);
      } else {
        await this.bracketNodes.save(parent);
      }
      return;
    }

    const existing = manager
      ? await manager.findOne(TournamentMatch, { where: { id: parent.matchId } })
      : await this.matches.findOne({ where: { id: parent.matchId } });
    if (!existing) return;

    if (isHomeFeeder && !existing.homeTeamId) {
      existing.homeTeamId = winnerTeamId;
    } else if (!isHomeFeeder && !existing.awayTeamId) {
      existing.awayTeamId = winnerTeamId;
    } else {
      return;
    }

    if (manager) {
      await manager.save(TournamentMatch, existing);
    } else {
      await this.matches.save(existing);
    }
  }

  private async tryAutoCompleteTournament(tournamentId: string): Promise<void> {
    const tournament = await this.tournaments.findOne({
      where: { id: tournamentId, deletedAt: IsNull() },
    });
    if (!tournament || tournament.status !== 'in_progress') return;

    const incompleteStages = await this.stages.count({
      where: {
        tournamentId,
        deletedAt: IsNull(),
        status: Not(In(['completed', 'cancelled'])),
      },
    });
    if (incompleteStages > 0) return;

    const openMatches = await this.matches.count({
      where: {
        tournamentId,
        deletedAt: IsNull(),
        status: Not(In(['approved', 'walkover', 'cancelled'])),
      },
    });
    if (openMatches > 0) return;

    tournament.status = 'completed';
    await this.tournaments.save(tournament);
  }
}
