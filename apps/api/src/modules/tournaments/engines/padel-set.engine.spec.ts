import { validatePadelMatchScore } from './padel-set.engine';

describe('validatePadelMatchScore', () => {
  it('accepts a single-set group match', () => {
    const result = validatePadelMatchScore([{ home: 6, away: 4 }], {
      setsToWin: 1,
    });
    expect(result).toEqual({
      sets: [{ home: 6, away: 4 }],
      homeSets: 1,
      awaySets: 0,
    });
  });

  it('accepts a best-of-3 knockout match', () => {
    const result = validatePadelMatchScore(
      [
        { home: 6, away: 4 },
        { home: 3, away: 6 },
        { home: 6, away: 2 },
      ],
      { setsToWin: 2 },
    );
    expect(result.homeSets).toBe(2);
    expect(result.awaySets).toBe(1);
  });

  it('rejects group match with two sets', () => {
    expect(() =>
      validatePadelMatchScore(
        [
          { home: 6, away: 4 },
          { home: 6, away: 3 },
        ],
        { setsToWin: 1 },
      ),
    ).toThrow('single set');
  });
});
