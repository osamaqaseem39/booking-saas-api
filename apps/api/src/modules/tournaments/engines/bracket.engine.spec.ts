import {
  generateKnockoutBracket,
  knockoutByeCount,
  pairConsecutiveTeams,
} from './bracket.engine';
import {
  buildNextRoundPairings,
  collectRoundWinners,
  findNextKnockoutRoundToGenerate,
  isKnockoutBracketFullyResolved,
} from './knockout-round.engine';

describe('power-of-2 knockout bracket', () => {
  it('pairs every team in round 1 when count is a power of 2', () => {
    expect(pairConsecutiveTeams(['a', 'b', 'c', 'd', 'e', 'f'])).toEqual([
      { homeTeamId: 'a', awayTeamId: 'b' },
      { homeTeamId: 'c', awayTeamId: 'd' },
      { homeTeamId: 'e', awayTeamId: 'f' },
    ]);
    const eight = generateKnockoutBracket(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(eight).toHaveLength(4);
    expect(eight.every((n) => !n.isBye && n.teamId && n.awayTeamId)).toBe(true);
    expect(knockoutByeCount(8)).toBe(0);
  });

  it('pads to next power of 2 with byes for top seeds', () => {
    const nine = generateKnockoutBracket(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
    expect(nine).toHaveLength(8);
    expect(knockoutByeCount(9)).toBe(7);
    expect(nine.filter((n) => n.isBye)).toHaveLength(7);
    expect(nine.filter((n) => n.isBye).map((n) => n.teamId)).toEqual([
      'a', 'b', 'c', 'd', 'e', 'f', 'g',
    ]);
    expect(nine.filter((n) => n.teamId && n.awayTeamId)).toEqual([
      expect.objectContaining({ teamId: 'h', awayTeamId: 'i' }),
    ]);
  });

  it('gives byes to top seeds for non-power-of-2 even counts', () => {
    const six = generateKnockoutBracket(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(six).toHaveLength(4);
    expect(knockoutByeCount(6)).toBe(2);
    expect(six.filter((n) => n.isBye)).toHaveLength(2);
    expect(six.filter((n) => n.isBye).map((n) => n.teamId)).toEqual(['a', 'b']);
    expect(six.filter((n) => n.teamId && n.awayTeamId)).toHaveLength(2);
  });

  it('advances winners through generated rounds without odd carry', () => {
    const r1 = generateKnockoutBracket(['a', 'b', 'c', 'd', 'e', 'f']);
    const matchById = new Map([
      ['m1', { id: 'm1', status: 'approved', homeTeamId: 'c', awayTeamId: 'd', homeScore: 2, awayScore: 0 }],
      ['m2', { id: 'm2', status: 'approved', homeTeamId: 'e', awayTeamId: 'f', homeScore: 1, awayScore: 0 }],
    ]);
    const nodes = r1.map((n, i) => ({
      ...n,
      matchId: n.isBye ? null : `m${i - 1}`,
    }));
    expect(findNextKnockoutRoundToGenerate(nodes, matchById)).toBe(2);
    const { matches, carryTeamId } = buildNextRoundPairings(
      collectRoundWinners(1, nodes, matchById),
    );
    expect(matches).toEqual([
      { homeTeamId: 'a', awayTeamId: 'b' },
      { homeTeamId: 'c', awayTeamId: 'e' },
    ]);
    expect(carryTeamId).toBeNull();
  });

  it('with 3 teams plays one semifinal then a final', () => {
    const r1 = generateKnockoutBracket(['a', 'b', 'c']);
    expect(r1.filter((n) => n.isBye)).toHaveLength(1);
    expect(r1.find((n) => n.isBye)?.teamId).toBe('a');
    expect(r1.filter((n) => n.teamId && n.awayTeamId)).toEqual([
      expect.objectContaining({ teamId: 'b', awayTeamId: 'c' }),
    ]);

    const matchById = new Map([
      ['m1', { id: 'm1', status: 'approved', homeTeamId: 'b', awayTeamId: 'c', homeScore: 2, awayScore: 1 }],
    ]);
    const nodes = r1.map((n) => ({
      ...n,
      matchId: n.isBye ? null : 'm1',
    }));
    expect(findNextKnockoutRoundToGenerate(nodes, matchById)).toBe(2);
    const { matches, carryTeamId } = buildNextRoundPairings(
      collectRoundWinners(1, nodes, matchById),
    );
    expect(matches).toEqual([{ homeTeamId: 'a', awayTeamId: 'b' }]);
    expect(carryTeamId).toBeNull();
  });

  it('with 5 teams produces two semifinals from round 1', () => {
    const r1 = generateKnockoutBracket(['a', 'b', 'c', 'd', 'e']);
    expect(knockoutByeCount(5)).toBe(3);
    expect(r1.filter((n) => n.isBye)).toHaveLength(3);
    const matchById = new Map([
      ['m1', { id: 'm1', status: 'approved', homeTeamId: 'd', awayTeamId: 'e', homeScore: 2, awayScore: 0 }],
    ]);
    const nodes = r1.map((n) => ({
      ...n,
      matchId: n.isBye ? null : 'm1',
    }));
    const { matches, carryTeamId } = buildNextRoundPairings(
      collectRoundWinners(1, nodes, matchById),
    );
    expect(matches).toEqual([
      { homeTeamId: 'a', awayTeamId: 'b' },
      { homeTeamId: 'c', awayTeamId: 'd' },
    ]);
    expect(carryTeamId).toBeNull();
  });

  it('resolves when a champion is decided', () => {
    const matchById = new Map([
      ['m1', { id: 'm1', status: 'approved', homeTeamId: 'a', awayTeamId: 'b', homeScore: 2, awayScore: 0 }],
      ['m2', { id: 'm2', status: 'approved', homeTeamId: 'a', awayTeamId: 'c', homeScore: 2, awayScore: 1 }],
    ]);
    const nodes = [
      { round: 1, slotIndex: 0, matchId: 'm1', isBye: false },
      { round: 2, slotIndex: 0, matchId: 'm2', isBye: false },
    ];
    expect(isKnockoutBracketFullyResolved(nodes, matchById)).toBe(true);
  });
});
