export type CricketInningsScore = {
  runs: number;
  wickets: number;
  balls: number;
};

export const MAX_CRICKET_WICKETS = 10;

export function ballsToOversDisplay(balls: number): string {
  const legal = Math.max(0, Math.floor(balls));
  return `${Math.floor(legal / 6)}.${legal % 6}`;
}

export function inferFirstBatting(
  home: CricketInningsScore,
  away: CricketInningsScore,
): 'home' | 'away' | null {
  if (home.balls > 0 && away.balls === 0) return 'home';
  if (away.balls > 0 && home.balls === 0) return 'away';
  if (home.balls > 0 && away.balls > 0) {
    return home.balls >= away.balls ? 'home' : 'away';
  }
  return null;
}

export function isChaseWon(
  chasing: CricketInningsScore,
  firstInningsRuns: number,
): boolean {
  return chasing.runs >= firstInningsRuns + 1;
}

export function resolveCricketWinnerSide(
  home: CricketInningsScore,
  away: CricketInningsScore,
  firstBatting: 'home' | 'away',
): 'home' | 'away' | null {
  const first = firstBatting === 'home' ? home : away;
  const second = firstBatting === 'home' ? away : home;
  if (isChaseWon(second, first.runs)) {
    return firstBatting === 'home' ? 'away' : 'home';
  }
  if (second.balls < 1) return null;
  if (second.runs < first.runs) return firstBatting;
  if (second.runs > first.runs) return firstBatting === 'home' ? 'away' : 'home';
  return null;
}

export function validateCricketMatchScore(
  home: CricketInningsScore,
  away: CricketInningsScore,
  maxOvers?: number,
): {
  homeRuns: number;
  awayRuns: number;
  home: CricketInningsScore;
  away: CricketInningsScore;
} {
  if (home.balls < 1 && away.balls < 1) {
    throw new Error('Enter at least one innings');
  }
  if (home.balls < 1 || away.balls < 1) {
    throw new Error('Both teams need a completed innings');
  }
  if (home.wickets > MAX_CRICKET_WICKETS || away.wickets > MAX_CRICKET_WICKETS) {
    throw new Error('Wickets cannot exceed 10');
  }
  const maxBalls = maxOvers != null ? maxOvers * 6 : undefined;
  if (maxBalls != null) {
    if (home.balls > maxBalls || away.balls > maxBalls) {
      throw new Error(`Innings cannot exceed ${maxOvers} overs`);
    }
  }
  return {
    homeRuns: home.runs,
    awayRuns: away.runs,
    home,
    away,
  };
}
