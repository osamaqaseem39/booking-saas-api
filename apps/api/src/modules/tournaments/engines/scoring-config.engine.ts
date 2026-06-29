import type { StructureBlueprint } from '../types/tournament.types';

export type TournamentScoringSettings = {
  padelBestOfSets?: 3 | 5;
  padelDeuceRule?: 'advantage' | 'golden_point';
  padelDecidingSet?: 'full_set' | 'super_tiebreak';
  cricketMaxOvers?: number;
  tableTennisBestOfGames?: 5 | 7;
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

export function tableTennisGamesToWin(bestOfGames: 5 | 7 = 5): number {
  return Math.ceil(bestOfGames / 2);
}

export function resolveTableTennisGamesToWin(
  blueprint?: StructureBlueprint | null,
): number {
  const bestOf = blueprint?.scoring?.tableTennisBestOfGames === 7 ? 7 : 5;
  return tableTennisGamesToWin(bestOf);
}

export function buildSportScoringConfig(input: {
  sport: string;
  padelBestOfSets?: number;
  padelDeuceRule?: string;
  padelDecidingSet?: string;
  cricketMaxOvers?: number;
  tableTennisBestOfGames?: number;
}): TournamentScoringSettings | undefined {
  const sport = input.sport.trim().toLowerCase();
  if (sport === 'padel') {
    return {
      padelBestOfSets: input.padelBestOfSets === 5 ? 5 : 3,
      padelDeuceRule:
        input.padelDeuceRule === 'advantage' ? 'advantage' : 'golden_point',
      padelDecidingSet:
        input.padelDecidingSet === 'super_tiebreak'
          ? 'super_tiebreak'
          : 'full_set',
    };
  }
  if (
    sport === 'cricket' &&
    input.cricketMaxOvers != null &&
    input.cricketMaxOvers > 0
  ) {
    return { cricketMaxOvers: input.cricketMaxOvers };
  }
  if (sport === 'table-tennis' || sport === 'table_tennis') {
    return {
      tableTennisBestOfGames: input.tableTennisBestOfGames === 7 ? 7 : 5,
    };
  }
  return undefined;
}
