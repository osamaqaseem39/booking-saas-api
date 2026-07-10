import {
  contiguousBookedWallEnd,
  findOverlappingItemIndices,
  liveBookingOccupiedEnd,
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

  it('contiguousBookedWallEnd chains only back-to-back segments', () => {
    const end = contiguousBookedWallEnd(
      [
        { startTime: '14:03', endTime: '15:03', itemStatus: 'confirmed' },
        { startTime: '15:03', endTime: '15:33', itemStatus: 'confirmed' },
        { startTime: '16:00', endTime: '17:00', itemStatus: 'confirmed' },
      ],
      '2026-07-10',
      (date, start, endTime) => ({
        startDatetime: new Date(`${date}T${start}:00.000Z`),
        endDatetime: new Date(`${date}T${endTime}:00.000Z`),
      }),
    );
    expect(end.toISOString()).toBe('2026-07-10T15:33:00.000Z');
  });

  it('extends live booking occupied end through now during overtime', () => {
    const scheduledEnd = new Date('2026-06-11T15:00:00.000Z');
    const now = new Date('2026-06-11T15:30:00.000Z');
    const occupied = liveBookingOccupiedEnd('live', scheduledEnd, now);
    expect(occupied.getTime()).toBe(now.getTime());
    expect(liveBookingOccupiedEnd('confirmed', scheduledEnd, now).getTime()).toBe(
      scheduledEnd.getTime(),
    );
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
