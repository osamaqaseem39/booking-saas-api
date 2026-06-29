import { validateTableTennisMatchScore } from './table-tennis-games.engine';

describe('validateTableTennisMatchScore', () => {
  it('accepts a 3-1 best-of-5 match', () => {
    const result = validateTableTennisMatchScore(
      [
        { home: 11, away: 8 },
        { home: 9, away: 11 },
        { home: 11, away: 6 },
        { home: 12, away: 10 },
      ],
      3,
    );
    expect(result.homeGames).toBe(3);
    expect(result.awayGames).toBe(1);
  });

  it('rejects a game without two-point margin', () => {
    expect(() =>
      validateTableTennisMatchScore([{ home: 11, away: 10 }], 1),
    ).toThrow('not a valid completed game');
  });

  it('accepts deuce game 16-14', () => {
    const result = validateTableTennisMatchScore([{ home: 16, away: 14 }], 1);
    expect(result.homeGames).toBe(1);
  });
});
