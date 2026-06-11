import {
  findOverlappingItemIndices,
  normalizeCourtKindForOverlap,
  wallTimeWindowsOverlap,
} from './booking-overlap.util';

describe('booking-overlap.util', () => {
  it('normalizes legacy turf court kinds', () => {
    expect(normalizeCourtKindForOverlap('futsal_court')).toBe('turf_court');
    expect(normalizeCourtKindForOverlap('cricket_court')).toBe('turf_court');
    expect(normalizeCourtKindForOverlap('padel_court')).toBe('padel_court');
  });

  it('detects overlapping wall windows', () => {
    const a0 = new Date('2026-06-11T14:00:00.000Z');
    const a1 = new Date('2026-06-11T15:00:00.000Z');
    const b0 = new Date('2026-06-11T14:00:00.000Z');
    const b1 = new Date('2026-06-11T15:00:00.000Z');
    expect(wallTimeWindowsOverlap(a0, a1, b0, b1)).toBe(true);

    const c0 = new Date('2026-06-11T15:00:00.000Z');
    const c1 = new Date('2026-06-11T16:00:00.000Z');
    expect(wallTimeWindowsOverlap(a0, a1, c0, c1)).toBe(false);
  });

  it('finds overlapping items on the same facility', () => {
    const overlap = findOverlappingItemIndices([
      {
        index: 0,
        courtKey: 'turf_court:c1',
        start: new Date('2026-06-11T14:00:00.000Z'),
        end: new Date('2026-06-11T15:00:00.000Z'),
      },
      {
        index: 1,
        courtKey: 'turf_court:c1',
        start: new Date('2026-06-11T14:00:00.000Z'),
        end: new Date('2026-06-11T16:00:00.000Z'),
      },
    ]);
    expect(overlap).toEqual([0, 1]);
  });
});
