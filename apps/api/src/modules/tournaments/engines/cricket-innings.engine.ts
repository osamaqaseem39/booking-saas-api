export type CricketInningsScore = {
  runs: number;
  wickets: number;
  balls: number;
};

export const MAX_CRICKET_WICKETS = 10;
export const SUPER_OVER_MAX_BALLS = 6;
export const SUPER_OVER_MAX_WICKETS = 2;

export type CricketSuperOverDetail = {
  home: CricketInningsScore;
  away: CricketInningsScore;
  firstBatting: 'home' | 'away';
};

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

export function inferSuperOverFirstBatting(
  mainFirstBatting: 'home' | 'away',
): 'home' | 'away' {
  return mainFirstBatting === 'home' ? 'away' : 'home';
}

export function isChaseWon(
  chasing: CricketInningsScore,
  firstInningsRuns: number,
): boolean {
  return chasing.runs >= firstInningsRuns + 1;
}

export function isCricketInningsEnded(
  innings: CricketInningsScore,
  maxOvers?: number,
  chaseTargetRuns?: number,
): boolean {
  if (chaseTargetRuns != null && innings.runs >= chaseTargetRuns) return true;
  if (innings.wickets >= MAX_CRICKET_WICKETS) return true;
  const maxBalls = maxOvers != null ? maxOvers * 6 : undefined;
  return maxBalls != null && innings.balls >= maxBalls;
}

export function isSuperOverInningsEnded(
  innings: CricketInningsScore,
  chaseTargetRuns?: number,
): boolean {
  if (chaseTargetRuns != null && innings.runs >= chaseTargetRuns) return true;
  if (innings.wickets >= SUPER_OVER_MAX_WICKETS) return true;
  return innings.balls >= SUPER_OVER_MAX_BALLS;
}

export function resolveSuperOverWinnerSide(
  home: CricketInningsScore,
  away: CricketInningsScore,
  firstBatting: 'home' | 'away',
): 'home' | 'away' | null {
  const first = firstBatting === 'home' ? home : away;
  const second = firstBatting === 'home' ? away : home;
  if (second.balls < 1) return null;
  if (isChaseWon(second, first.runs)) {
    return firstBatting === 'home' ? 'away' : 'home';
  }
  if (
    !isSuperOverInningsEnded(first) ||
    !isSuperOverInningsEnded(second, first.runs + 1)
  ) {
    return null;
  }
  if (second.runs < first.runs) return firstBatting;
  if (second.runs > first.runs) return firstBatting === 'home' ? 'away' : 'home';
  return null;
}

export function resolveCricketWinnerSide(
  home: CricketInningsScore,
  away: CricketInningsScore,
  firstBatting: 'home' | 'away',
  superOver?: CricketSuperOverDetail | null,
): 'home' | 'away' | null {
  if (superOver && (superOver.home.balls > 0 || superOver.away.balls > 0)) {
    return resolveSuperOverWinnerSide(
      superOver.home,
      superOver.away,
      superOver.firstBatting,
    );
  }
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

function validateSuperOverInnings(
  home: CricketInningsScore,
  away: CricketInningsScore,
  firstBatting: 'home' | 'away',
): void {
  if (home.balls < 1 || away.balls < 1) {
    throw new Error('Both teams need a completed super over');
  }
  if (
    home.wickets > SUPER_OVER_MAX_WICKETS ||
    away.wickets > SUPER_OVER_MAX_WICKETS
  ) {
    throw new Error('Super over allows at most 2 wickets');
  }
  if (home.balls > SUPER_OVER_MAX_BALLS || away.balls > SUPER_OVER_MAX_BALLS) {
    throw new Error('Super over cannot exceed 1 over');
  }
  const winner = resolveSuperOverWinnerSide(home, away, firstBatting);
  if (winner == null) {
    throw new Error('Super over tied — replay super over');
  }
}

export function validateCricketMatchScore(
  home: CricketInningsScore,
  away: CricketInningsScore,
  maxOvers?: number,
  superOver?: CricketSuperOverDetail | null,
  opts?: { isKnockout?: boolean },
): {
  homeRuns: number;
  awayRuns: number;
  home: CricketInningsScore;
  away: CricketInningsScore;
  superOver?: CricketSuperOverDetail;
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
  const mainTied = home.runs === away.runs;
  if (mainTied) {
    if (!superOver || (superOver.home.balls < 1 && superOver.away.balls < 1)) {
      if (opts?.isKnockout) {
        throw new Error('Scores tied — play a super over');
      }
      return {
        homeRuns: home.runs,
        awayRuns: away.runs,
        home,
        away,
      };
    }
    validateSuperOverInnings(
      superOver.home,
      superOver.away,
      superOver.firstBatting,
    );
    return {
      homeRuns: home.runs,
      awayRuns: away.runs,
      home,
      away,
      superOver,
    };
  }
  if (superOver && (superOver.home.balls > 0 || superOver.away.balls > 0)) {
    throw new Error('Super over is only used when main innings are tied');
  }
  return {
    homeRuns: home.runs,
    awayRuns: away.runs,
    home,
    away,
  };
}
