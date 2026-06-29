import type { StructureBlueprint } from '../types/tournament.types';

export type TournamentScoringSettings = {
  padelBestOfSets?: 3 | 5;
  cricketMaxOvers?: number;
};

export function padelSetsToWin(bestOfSets: 3 | 5 = 3): number {
  return Math.ceil(bestOfSets / 2);
}

export function resolvePadelSetsToWin(
  blueprint?: StructureBlueprint | null,
): number {
  const bestOf = blueprint?.scoring?.padelBestOfSets === 5 ? 5 : 3;
  return padelSetsToWin(bestOf);
}

export function resolveCricketMaxOvers(
  blueprint?: StructureBlueprint | null,
): number | undefined {
  const v = blueprint?.scoring?.cricketMaxOvers;
  return v != null && v > 0 ? v : undefined;
}

export function buildSportScoringConfig(input: {
  sport: string;
  padelBestOfSets?: number;
  cricketMaxOvers?: number;
}): TournamentScoringSettings | undefined {
  const sport = input.sport.trim().toLowerCase();
  if (sport === 'padel') {
    return { padelBestOfSets: input.padelBestOfSets === 5 ? 5 : 3 };
  }
  if (
    sport === 'cricket' &&
    input.cricketMaxOvers != null &&
    input.cricketMaxOvers > 0
  ) {
    return { cricketMaxOvers: input.cricketMaxOvers };
  }
  return undefined;
}
