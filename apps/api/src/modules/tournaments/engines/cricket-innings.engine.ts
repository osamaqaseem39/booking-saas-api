export type CricketInningsScore = {
  runs: number;
  wickets: number;
  balls: number;
};

export function ballsToOversDisplay(balls: number): string {
  const legal = Math.max(0, Math.floor(balls));
  return `${Math.floor(legal / 6)}.${legal % 6}`;
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
  if (home.wickets > 10 || away.wickets > 10) {
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
