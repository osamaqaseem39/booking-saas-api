export type PadelSetScore = { home: number; away: number };

export function padelSetWinner(
  home: number,
  away: number,
): 'home' | 'away' | null {
  if (home === away) return null;
  const w = Math.max(home, away);
  const l = Math.min(home, away);
  if (w < 6) return null;
  if (w === 6 && l <= 4) return home > away ? 'home' : 'away';
  if (w === 7 && l >= 5 && l <= 6) return home > away ? 'home' : 'away';
  if (w > 7 && w - l >= 2) return home > away ? 'home' : 'away';
  return null;
}

export function countPadelSetsWon(sets: PadelSetScore[]): {
  home: number;
  away: number;
} {
  let home = 0;
  let away = 0;
  for (const s of sets) {
    const w = padelSetWinner(s.home, s.away);
    if (w === 'home') home += 1;
    if (w === 'away') away += 1;
  }
  return { home, away };
}

export type PadelMatchScoreOptions = {
  setsToWin?: number;
};

export function validatePadelMatchScore(
  sets: PadelSetScore[],
  options?: PadelMatchScoreOptions,
): {
  sets: PadelSetScore[];
  homeSets: number;
  awaySets: number;
} {
  const setsToWin = options?.setsToWin ?? 2;
  const active = sets.filter((s) => s.home > 0 || s.away > 0);
  if (active.length === 0) {
    throw new Error('Enter at least one completed set');
  }
  for (const s of active) {
    if (!padelSetWinner(s.home, s.away)) {
      throw new Error(`Set ${s.home}-${s.away} is not a valid completed set`);
    }
  }
  const { home, away } = countPadelSetsWon(active);
  if (home === away) {
    throw new Error('Match cannot end in a draw');
  }
  if (Math.max(home, away) !== setsToWin) {
    throw new Error(
      setsToWin === 1
        ? 'Group matches are won in a single set'
        : 'Winning side must win 2 sets',
    );
  }
  if (setsToWin === 1) {
    if (active.length !== 1) {
      throw new Error('A single-set match needs exactly 1 set');
    }
    return { sets: active, homeSets: home, awaySets: away };
  }
  if (home + away === 2 && active.length !== 2) {
    throw new Error('A 2-0 match needs exactly 2 sets');
  }
  if (home + away === 3 && active.length !== 3) {
    throw new Error('A 2-1 match needs exactly 3 sets');
  }
  return { sets: active, homeSets: home, awaySets: away };
}
