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

export function validatePadelMatchScore(
  sets: PadelSetScore[],
  setsToWin = 2,
): {
  sets: PadelSetScore[];
  homeSets: number;
  awaySets: number;
} {
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
    throw new Error(`Winning side must win ${setsToWin} sets`);
  }
  const totalSets = home + away;
  const maxSets = setsToWin * 2 - 1;
  if (totalSets < setsToWin || totalSets > maxSets) {
    throw new Error('Invalid set count for match result');
  }
  if (active.length !== totalSets) {
    throw new Error(`Match needs exactly ${totalSets} completed sets`);
  }
  return { sets: active, homeSets: home, awaySets: away };
}
