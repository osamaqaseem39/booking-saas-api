import {
  validateSubmitScorePayload,
  walkoverScoreForSport,
} from './match-score-validation.engine';

describe('validateSubmitScorePayload', () => {
  it('rejects padel score without sets', () => {
    expect(() =>
      validateSubmitScorePayload(
        { sport: 'padel', blueprint: { scoring: { padelBestOfSets: 3 } } as never, isKnockout: false },
        { homeScore: 2, awayScore: 0 },
      ),
    ).toThrow('set-by-set');
  });

  it('accepts valid padel sets for best of 3', () => {
    const result = validateSubmitScorePayload(
      { sport: 'padel', blueprint: { scoring: { padelBestOfSets: 3 } } as never, isKnockout: false },
      {
        homeScore: 2,
        awayScore: 0,
        sets: [
          { home: 6, away: 4 },
          { home: 6, away: 3 },
        ],
      },
    );
    expect(result.homeScore).toBe(2);
    expect(result.metadata.sets).toHaveLength(2);
  });

  it('rejects cricket score without innings', () => {
    expect(() =>
      validateSubmitScorePayload(
        { sport: 'cricket', blueprint: { scoring: { cricketMaxOvers: 20 } } as never, isKnockout: false },
        { homeScore: 120, awayScore: 110 },
      ),
    ).toThrow('innings detail');
  });

  it('rejects knockout draw for futsal', () => {
    expect(() =>
      validateSubmitScorePayload(
        { sport: 'futsal', blueprint: null, isKnockout: true },
        { homeScore: 2, awayScore: 2 },
      ),
    ).toThrow('draw');
  });
});

describe('walkoverScoreForSport', () => {
  it('uses sets to win for padel walkover', () => {
    const result = walkoverScoreForSport('padel', { scoring: { padelBestOfSets: 5 } } as never, 'home');
    expect(result.homeScore).toBe(3);
    expect(result.awayScore).toBe(0);
  });
});
