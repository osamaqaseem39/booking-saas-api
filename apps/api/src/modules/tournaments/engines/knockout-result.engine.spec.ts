import { resolveMatchWinner } from './knockout-result.engine';

describe('resolveMatchWinner', () => {
  const base = {
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeScore: 2,
    awayScore: 2,
  };

  it('returns null on tied approved knockout scores', () => {
    expect(
      resolveMatchWinner({ ...base, status: 'approved' }),
    ).toBeNull();
  });

  it('returns null on tied walkover scores', () => {
    expect(
      resolveMatchWinner({ ...base, status: 'walkover' }),
    ).toBeNull();
  });

  it('returns null on tied completed scores', () => {
    expect(
      resolveMatchWinner({ ...base, status: 'completed' }),
    ).toBeNull();
  });

  it('returns away winner when away leads', () => {
    expect(
      resolveMatchWinner({
        ...base,
        homeScore: 1,
        awayScore: 3,
        status: 'approved',
      }),
    ).toBe('away');
  });

  it('resolves cricket winner from innings metadata when main runs are tied', () => {
    expect(
      resolveMatchWinner({
        homeTeamId: 'home',
        awayTeamId: 'away',
        homeScore: 120,
        awayScore: 120,
        status: 'approved',
        metadata: {
          scoring: 'cricket_innings',
          firstBatting: 'home',
          homeInnings: { runs: 120, wickets: 5, balls: 72 },
          awayInnings: { runs: 118, wickets: 10, balls: 72 },
          homeSuperOver: { runs: 8, wickets: 0, balls: 6 },
          awaySuperOver: { runs: 6, wickets: 1, balls: 6 },
          superOverFirstBatting: 'away',
        },
      }),
    ).toBe('home');
  });
});
