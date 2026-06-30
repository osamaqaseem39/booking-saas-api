import {
  inferFirstBatting,
  resolveCricketWinnerSide,
  type CricketInningsScore,
  type CricketSuperOverDetail,
} from './cricket-innings.engine';

const RESOLVED_STATUSES = new Set(['approved', 'walkover', 'completed']);

function parseInnings(value: unknown): CricketInningsScore | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.runs !== 'number' ||
    typeof row.wickets !== 'number' ||
    typeof row.balls !== 'number'
  ) {
    return null;
  }
  return { runs: row.runs, wickets: row.wickets, balls: row.balls };
}

function parseCricketSuperOver(
  metadata: Record<string, unknown>,
): CricketSuperOverDetail | null {
  const home = parseInnings(metadata.homeSuperOver);
  const away = parseInnings(metadata.awaySuperOver);
  const firstBatting =
    metadata.superOverFirstBatting === 'home' ||
    metadata.superOverFirstBatting === 'away'
      ? metadata.superOverFirstBatting
      : null;
  if (!home || !away || !firstBatting) return null;
  if (home.balls < 1 && away.balls < 1) return null;
  return { home, away, firstBatting };
}

function resolveCricketKnockoutWinner(match: {
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  metadata?: Record<string, unknown> | null;
}): string | null {
  const metadata = match.metadata;
  if (!metadata || metadata.scoring !== 'cricket_innings') return null;
  const homeInnings = parseInnings(metadata.homeInnings);
  const awayInnings = parseInnings(metadata.awayInnings);
  if (!homeInnings || !awayInnings) return null;
  const firstBatting =
    metadata.firstBatting === 'home' || metadata.firstBatting === 'away'
      ? metadata.firstBatting
      : inferFirstBatting(homeInnings, awayInnings);
  if (!firstBatting) return null;
  const side = resolveCricketWinnerSide(
    homeInnings,
    awayInnings,
    firstBatting,
    parseCricketSuperOver(metadata),
  );
  if (side === 'home') return match.homeTeamId ?? null;
  if (side === 'away') return match.awayTeamId ?? null;
  return null;
}

export function resolveMatchWinner(match: {
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  status: string;
  metadata?: Record<string, unknown> | null;
}): string | null {
  if (!match.homeTeamId && !match.awayTeamId) return null;
  if (!RESOLVED_STATUSES.has(match.status)) return null;

  const cricketWinner = resolveCricketKnockoutWinner(match);
  if (cricketWinner) return cricketWinner;

  const home = match.homeScore ?? 0;
  const away = match.awayScore ?? 0;
  if (home > away) return match.homeTeamId ?? null;
  if (away > home) return match.awayTeamId ?? null;
  return null;
}
