import { nextPowerOfTwo } from './structure.engine';
import type { SeedingMode } from '../types/tournament.types';

export type BracketNodeDraft = {
  round: number;
  slotIndex: number;
  parentNodeId?: string;
  parentRound?: number;
  parentSlotIndex?: number;
  teamId?: string;
  awayTeamId?: string;
  isBye: boolean;
  winnerAdvancesToNodeId?: string;
};

export function log2(n: number): number {
  return Math.log2(n);
}

export function knockoutRoundCount(teamCount: number): number {
  if (teamCount < 2) return 0;
  return Math.log2(nextPowerOfTwo(teamCount));
}

export function knockoutByeCount(teamCount: number): number {
  if (teamCount < 2) return 0;
  return nextPowerOfTwo(teamCount) - teamCount;
}

export function pairConsecutiveTeams(
  teamIds: string[],
): { homeTeamId: string; awayTeamId: string }[] {
  const pairs: { homeTeamId: string; awayTeamId: string }[] = [];
  for (let i = 0; i + 1 < teamIds.length; i += 2) {
    pairs.push({ homeTeamId: teamIds[i], awayTeamId: teamIds[i + 1] });
  }
  return pairs;
}

export function orderTeamsForKnockout(
  teamIds: string[],
  seedingMode: SeedingMode = 'ranking',
): string[] {
  if (seedingMode !== 'random') return teamIds;
  const shuffled = [...teamIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function generateKnockoutBracket(
  teamIds: string[],
  _bracketSize?: number,
): BracketNodeDraft[] {
  const n = teamIds.length;
  if (n < 2) return [];

  const bracketSize = nextPowerOfTwo(n);
  const byeCount = bracketSize - n;
  const nodes: BracketNodeDraft[] = [];
  let slotIndex = 0;

  for (let i = 0; i < byeCount; i++) {
    nodes.push({
      round: 1,
      slotIndex: slotIndex++,
      teamId: teamIds[i],
      isBye: true,
    });
  }

  const pairs = pairConsecutiveTeams(teamIds.slice(byeCount));
  for (const pair of pairs) {
    nodes.push({
      round: 1,
      slotIndex: slotIndex++,
      teamId: pair.homeTeamId,
      awayTeamId: pair.awayTeamId,
      isBye: false,
    });
  }

  return nodes;
}
