export type FixtureDraft = {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
};

function rotate(ids: string[]): void {
  const fixed = ids[0];
  const rest = ids.slice(1);
  rest.unshift(rest.pop()!);
  ids.splice(0, ids.length, fixed, ...rest);
}

function renumberRounds(fixtures: FixtureDraft[]): FixtureDraft[] {
  const byOldRound = new Map<number, FixtureDraft[]>();
  for (const f of fixtures) {
    const list = byOldRound.get(f.round) ?? [];
    list.push(f);
    byOldRound.set(f.round, list);
  }
  const orderedRounds = [...byOldRound.keys()].sort((a, b) => a - b);
  const out: FixtureDraft[] = [];
  orderedRounds.forEach((oldRound, i) => {
    for (const f of byOldRound.get(oldRound)!) {
      out.push({ ...f, round: i + 1 });
    }
  });
  return out;
}

/** Full single round-robin (circle method). Odd team counts get a bye each round. */
export function generateFullRoundRobin(teamIds: string[]): FixtureDraft[] {
  const ids = [...teamIds];
  if (ids.length < 2) return [];
  if (ids.length % 2 === 1) ids.push('__BYE__');
  const n = ids.length;
  const rounds = n - 1;
  const fixtures: FixtureDraft[] = [];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const home = ids[i];
      const away = ids[n - 1 - i];
      if (home !== '__BYE__' && away !== '__BYE__') {
        fixtures.push({ round: r + 1, homeTeamId: home, awayTeamId: away });
      }
    }
    rotate(ids);
  }
  return fixtures;
}

/**
 * Enough round-robin legs (alternating home/away) to cover `matchesPerTeam`.
 * Then greedily keep fixtures so every team gets as close as possible to the target
 * (avoids bye-starvation from truncating circle rounds on odd-sized groups).
 */
export function generateRoundRobinFixtures(
  teamIds: string[],
  matchesPerTeam?: number,
): FixtureDraft[] {
  const unique = [...new Set(teamIds.filter(Boolean))];
  if (unique.length < 2) return [];

  const maxSingle = unique.length - 1;
  const maxDouble = maxSingle * 2;
  const requested =
    matchesPerTeam == null
      ? maxSingle
      : Math.max(1, Math.min(matchesPerTeam, maxDouble));

  const legsNeeded = Math.max(1, Math.ceil(requested / maxSingle));
  const pool: FixtureDraft[] = [];
  for (let leg = 0; leg < legsNeeded; leg++) {
    const base = generateFullRoundRobin(unique);
    for (const f of base) {
      const home = leg % 2 === 1 ? f.awayTeamId : f.homeTeamId;
      const away = leg % 2 === 1 ? f.homeTeamId : f.awayTeamId;
      pool.push({
        round: leg * maxSingle + f.round,
        homeTeamId: home,
        awayTeamId: away,
      });
    }
  }

  if (requested >= legsNeeded * maxSingle) {
    return renumberRounds(pool);
  }

  const played = new Map<string, number>(unique.map((id) => [id, 0]));
  const selected: FixtureDraft[] = [];

  for (const f of pool) {
    const homeCount = played.get(f.homeTeamId) ?? 0;
    const awayCount = played.get(f.awayTeamId) ?? 0;
    if (homeCount >= requested || awayCount >= requested) continue;
    selected.push(f);
    played.set(f.homeTeamId, homeCount + 1);
    played.set(f.awayTeamId, awayCount + 1);
  }

  return renumberRounds(selected);
}

/** Count games per team in a fixture list (for tests / diagnostics). */
export function countMatchesPerTeam(
  fixtures: FixtureDraft[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const f of fixtures) {
    counts.set(f.homeTeamId, (counts.get(f.homeTeamId) ?? 0) + 1);
    counts.set(f.awayTeamId, (counts.get(f.awayTeamId) ?? 0) + 1);
  }
  return counts;
}
