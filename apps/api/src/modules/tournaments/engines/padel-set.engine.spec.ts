import { validatePadelMatchScore } from './padel-set.engine';

describe('validatePadelMatchScore', () => {
  it('accepts a 2-0 best-of-3 match', () => {
    const result = validatePadelMatchScore(
      [
        { home: 6, away: 4 },
        { home: 6, away: 3 },
      ],
      2,
    );
    expect(result.homeSets).toBe(2);
  });

  it('accepts a 3-2 best-of-5 match', () => {
    const result = validatePadelMatchScore(
      [
        { home: 6, away: 4 },
        { home: 4, away: 6 },
        { home: 6, away: 3 },
        { home: 3, away: 6 },
        { home: 6, away: 2 },
      ],
      3,
    );
    expect(result.homeSets).toBe(3);
    expect(result.awaySets).toBe(2);
  });

  it('rejects a single-set result for best of 3', () => {
    expect(() => validatePadelMatchScore([{ home: 6, away: 4 }], 2)).toThrow(
      '2 sets',
    );
  });
});
