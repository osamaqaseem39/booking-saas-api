import { pickAdvancingTeams } from './advancement.engine';
import { DEFAULT_STANDINGS_RULES } from '../types/tournament.types';

const rules = DEFAULT_STANDINGS_RULES;

function group(
  name: string,
  teamIds: string[],
  results: {
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
  }[],
) {
  return {
    groupId: name,
    groupName: name,
    teamIds,
    results,
    rules,
  };
}

describe('pickAdvancingTeams', () => {
  it('interleaves top teams from every group for knockout seeding', () => {
    const teams = pickAdvancingTeams(
      [
        group('A', ['a1', 'a2', 'a3'], [
          { homeTeamId: 'a1', awayTeamId: 'a2', homeScore: 2, awayScore: 0 },
          { homeTeamId: 'a1', awayTeamId: 'a3', homeScore: 1, awayScore: 0 },
          { homeTeamId: 'a2', awayTeamId: 'a3', homeScore: 1, awayScore: 0 },
        ]),
        group('B', ['b1', 'b2', 'b3'], [
          { homeTeamId: 'b1', awayTeamId: 'b2', homeScore: 2, awayScore: 0 },
          { homeTeamId: 'b1', awayTeamId: 'b3', homeScore: 1, awayScore: 0 },
          { homeTeamId: 'b2', awayTeamId: 'b3', homeScore: 1, awayScore: 0 },
        ]),
        group('C', ['c1', 'c2', 'c3'], [
          { homeTeamId: 'c1', awayTeamId: 'c2', homeScore: 2, awayScore: 0 },
          { homeTeamId: 'c1', awayTeamId: 'c3', homeScore: 1, awayScore: 0 },
          { homeTeamId: 'c2', awayTeamId: 'c3', homeScore: 1, awayScore: 0 },
        ]),
        group('D', ['d1', 'd2', 'd3'], [
          { homeTeamId: 'd1', awayTeamId: 'd2', homeScore: 2, awayScore: 0 },
          { homeTeamId: 'd1', awayTeamId: 'd3', homeScore: 1, awayScore: 0 },
          { homeTeamId: 'd2', awayTeamId: 'd3', homeScore: 1, awayScore: 0 },
        ]),
      ],
      { topNPerGroup: 2 },
    );

    expect(teams).toEqual([
      'a1',
      'b1',
      'c1',
      'd1',
      'a2',
      'b2',
      'c2',
      'd2',
    ]);
    expect(new Set(teams).size).toBe(8);
  });

  it('includes every group even when a group has fewer teams than topN', () => {
    const teams = pickAdvancingTeams(
      [
        group('A', ['a1', 'a2'], [
          { homeTeamId: 'a1', awayTeamId: 'a2', homeScore: 1, awayScore: 0 },
        ]),
        group('B', ['b1'], []),
      ],
      { topNPerGroup: 2 },
    );

    expect(teams).toEqual(['a1', 'b1', 'a2']);
  });
});
