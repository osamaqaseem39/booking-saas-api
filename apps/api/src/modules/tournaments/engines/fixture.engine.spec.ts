import {
  countMatchesPerTeam,
  generateRoundRobinFixtures,
} from './fixture.engine';

describe('generateRoundRobinFixtures', () => {
  it('gives every team the same match count for even groups', () => {
    const teams = ['a', 'b', 'c', 'd'];
    const fixtures = generateRoundRobinFixtures(teams, 2);
    const counts = countMatchesPerTeam(fixtures);
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
    expect(fixtures).toHaveLength(4);
  });

  it('balances odd groups so every team plays n-1 in a full single robin', () => {
    const teams = ['a', 'b', 'c'];
    const fixtures = generateRoundRobinFixtures(teams, 2);
    const counts = countMatchesPerTeam(fixtures);
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
    expect(fixtures).toHaveLength(3);
  });

  it('uses a second leg when matchesPerTeam > n-1', () => {
    const teams = ['a', 'b', 'c'];
    const fixtures = generateRoundRobinFixtures(teams, 3);
    const counts = countMatchesPerTeam(fixtures);
    const values = [...counts.values()].sort((a, b) => a - b);
    // 3*3 is odd — exact 3 each is impossible; stay within 1 of target
    expect(values.every((n) => n >= 2 && n <= 3)).toBe(true);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    expect(fixtures.length).toBeGreaterThanOrEqual(4);
  });

  it('balances 5 teams at 2 matches each', () => {
    const teams = ['1', '2', '3', '4', '5'];
    const fixtures = generateRoundRobinFixtures(teams, 2);
    const counts = countMatchesPerTeam(fixtures);
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
    expect(fixtures).toHaveLength(5);
  });

  it('full round robin when matchesPerTeam omitted', () => {
    const teams = ['a', 'b', 'c', 'd'];
    const fixtures = generateRoundRobinFixtures(teams);
    const counts = countMatchesPerTeam(fixtures);
    expect([...counts.values()].every((n) => n === 3)).toBe(true);
    expect(fixtures).toHaveLength(6);
  });

  it('caps at double round robin', () => {
    const teams = ['a', 'b', 'c'];
    const fixtures = generateRoundRobinFixtures(teams, 99);
    const counts = countMatchesPerTeam(fixtures);
    expect([...counts.values()].every((n) => n === 4)).toBe(true);
    expect(fixtures).toHaveLength(6);
  });
});
