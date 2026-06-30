import { inferFirstBatting, validateCricketMatchScore } from './cricket-innings.engine';
import { validatePadelMatchScore } from './padel-set.engine';
import {
  resolveCricketMaxOvers,
  resolvePadelSetsToWin,
  resolveTableTennisGamesToWin,
} from './scoring-config.engine';
import { validateTableTennisMatchScore } from './table-tennis-games.engine';
import type { StructureBlueprint } from '../types/tournament.types';

export type SubmitScorePayload = {
  homeScore: number;
  awayScore: number;
  sets?: { home: number; away: number; superTiebreak?: boolean }[];
  games?: { home: number; away: number }[];
  homeInnings?: { runs: number; wickets: number; balls: number };
  awayInnings?: { runs: number; wickets: number; balls: number };
  firstBatting?: 'home' | 'away';
  homeSuperOver?: { runs: number; wickets: number; balls: number };
  awaySuperOver?: { runs: number; wickets: number; balls: number };
  superOverFirstBatting?: 'home' | 'away';
};

export type SubmitScoreContext = {
  sport: string;
  blueprint: StructureBlueprint | null;
  isKnockout: boolean;
};

export type ValidatedMatchScore = {
  homeScore: number;
  awayScore: number;
  metadata: Record<string, unknown>;
};

export function normalizeTournamentSport(
  sport: string,
): 'padel' | 'cricket' | 'futsal' | 'table_tennis' | 'other' {
  const s = sport.trim().toLowerCase();
  if (s === 'padel') return 'padel';
  if (s === 'cricket') return 'cricket';
  if (s === 'futsal') return 'futsal';
  if (s === 'table-tennis' || s === 'table_tennis') return 'table_tennis';
  return 'other';
}

export function validateSubmitScorePayload(
  ctx: SubmitScoreContext,
  dto: SubmitScorePayload,
): ValidatedMatchScore {
  const sport = normalizeTournamentSport(ctx.sport);
  const hasSets = (dto.sets?.length ?? 0) > 0;
  const hasGames = (dto.games?.length ?? 0) > 0;
  const hasInnings = Boolean(dto.homeInnings && dto.awayInnings);

  if (sport === 'padel') {
    if (!hasSets) {
      throw new Error('Padel matches require set-by-set scores');
    }
    if (hasInnings || hasGames) {
      throw new Error('Padel matches cannot include innings or game detail');
    }
    const validated = validatePadelMatchScore(
      dto.sets!,
      resolvePadelSetsToWin(ctx.blueprint),
    );
    if (ctx.isKnockout && validated.homeSets === validated.awaySets) {
      throw new Error('Knockout matches cannot end in a draw');
    }
    return {
      homeScore: validated.homeSets,
      awayScore: validated.awaySets,
      metadata: {
        scoring: 'padel_sets',
        sets: validated.sets,
        padelBestOfSets: ctx.blueprint?.scoring?.padelBestOfSets ?? 3,
      },
    };
  }

  if (sport === 'cricket') {
    if (!hasInnings) {
      throw new Error(
        'Cricket matches require innings detail (runs, wickets, balls)',
      );
    }
    if (hasSets || hasGames) {
      throw new Error('Cricket matches cannot include set or game detail');
    }
    const superOver =
      dto.homeSuperOver &&
      dto.awaySuperOver &&
      (dto.superOverFirstBatting === 'home' || dto.superOverFirstBatting === 'away')
        ? {
            home: dto.homeSuperOver,
            away: dto.awaySuperOver,
            firstBatting: dto.superOverFirstBatting,
          }
        : null;
    const validated = validateCricketMatchScore(
      dto.homeInnings!,
      dto.awayInnings!,
      resolveCricketMaxOvers(ctx.blueprint),
      superOver,
      { isKnockout: ctx.isKnockout },
    );
    const firstBatting =
      dto.firstBatting === 'home' || dto.firstBatting === 'away'
        ? dto.firstBatting
        : inferFirstBatting(validated.home, validated.away);
    return {
      homeScore: validated.homeRuns,
      awayScore: validated.awayRuns,
      metadata: {
        scoring: 'cricket_innings',
        homeInnings: validated.home,
        awayInnings: validated.away,
        firstBatting,
        cricketMaxOvers: ctx.blueprint?.scoring?.cricketMaxOvers ?? null,
        ...(validated.superOver
          ? {
              homeSuperOver: validated.superOver.home,
              awaySuperOver: validated.superOver.away,
              superOverFirstBatting: validated.superOver.firstBatting,
            }
          : {}),
      },
    };
  }

  if (sport === 'table_tennis') {
    if (!hasGames) {
      throw new Error('Table tennis matches require game-by-game scores');
    }
    if (hasSets || hasInnings) {
      throw new Error('Table tennis matches cannot include set or innings detail');
    }
    const validated = validateTableTennisMatchScore(
      dto.games!,
      resolveTableTennisGamesToWin(ctx.blueprint),
    );
    if (ctx.isKnockout && validated.homeGames === validated.awayGames) {
      throw new Error('Knockout matches cannot end in a draw');
    }
    return {
      homeScore: validated.homeGames,
      awayScore: validated.awayGames,
      metadata: {
        scoring: 'table_tennis_games',
        games: validated.games,
        tableTennisBestOfGames:
          ctx.blueprint?.scoring?.tableTennisBestOfGames ?? 5,
      },
    };
  }

  if (hasSets || hasInnings || hasGames) {
    throw new Error(
      `Set, game, or innings detail is not valid for ${ctx.sport} matches`,
    );
  }
  if (sport === 'futsal') {
    if (ctx.isKnockout && dto.homeScore === dto.awayScore) {
      throw new Error('Knockout matches cannot end in a draw');
    }
    return {
      homeScore: dto.homeScore,
      awayScore: dto.awayScore,
      metadata: { scoring: 'futsal_goals' },
    };
  }
  if (dto.homeScore === 0 && dto.awayScore === 0) {
    throw new Error('Enter a match score');
  }
  if (ctx.isKnockout && dto.homeScore === dto.awayScore) {
    throw new Error('Knockout matches cannot end in a draw');
  }
  return {
    homeScore: dto.homeScore,
    awayScore: dto.awayScore,
    metadata: {},
  };
}

export function walkoverScoreForSport(
  sport: string,
  blueprint: StructureBlueprint | null,
  winnerSide: 'home' | 'away',
): ValidatedMatchScore {
  const normalized = normalizeTournamentSport(sport);
  if (normalized === 'padel') {
    const setsToWin = resolvePadelSetsToWin(blueprint);
    const sets = Array.from({ length: setsToWin }, () =>
      winnerSide === 'home' ? { home: 6, away: 0 } : { home: 0, away: 6 },
    );
    return {
      homeScore: winnerSide === 'home' ? setsToWin : 0,
      awayScore: winnerSide === 'away' ? setsToWin : 0,
      metadata: {
        scoring: 'padel_sets',
        walkover: true,
        sets,
        padelBestOfSets: blueprint?.scoring?.padelBestOfSets ?? 3,
      },
    };
  }
  if (normalized === 'cricket') {
    return {
      homeScore: winnerSide === 'home' ? 1 : 0,
      awayScore: winnerSide === 'away' ? 1 : 0,
      metadata: {
        scoring: 'cricket_innings',
        walkover: true,
        homeInnings: {
          runs: winnerSide === 'home' ? 1 : 0,
          wickets: 0,
          balls: 1,
        },
        awayInnings: {
          runs: winnerSide === 'away' ? 1 : 0,
          wickets: 0,
          balls: 1,
        },
      },
    };
  }
  if (normalized === 'table_tennis') {
    const gamesToWin = resolveTableTennisGamesToWin(blueprint);
    const games = Array.from({ length: gamesToWin }, () =>
      winnerSide === 'home' ? { home: 11, away: 0 } : { home: 0, away: 11 },
    );
    return {
      homeScore: winnerSide === 'home' ? gamesToWin : 0,
      awayScore: winnerSide === 'away' ? gamesToWin : 0,
      metadata: {
        scoring: 'table_tennis_games',
        walkover: true,
        games,
        tableTennisBestOfGames: blueprint?.scoring?.tableTennisBestOfGames ?? 5,
      },
    };
  }
  return {
    homeScore: winnerSide === 'home' ? 3 : 0,
    awayScore: winnerSide === 'away' ? 3 : 0,
    metadata: { walkover: true },
  };
}
