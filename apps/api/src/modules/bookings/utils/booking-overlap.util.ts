export function normalizeCourtKindForOverlap(kind: string): string {
  if (kind === 'futsal_court' || kind === 'cricket_court') return 'turf_court';
  return kind;
}

export function wallTimeWindowsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

/** Live sessions still occupy the field through `now` when past scheduled end (overtime). */
export function liveBookingOccupiedEnd(
  bookingStatus: string,
  endDatetime: Date,
  now = new Date(),
): Date {
  if (bookingStatus !== 'live') return endDatetime;
  return new Date(Math.max(endDatetime.getTime(), now.getTime()));
}

export function itemWallWindowFromParts(
  itemDate: string,
  startTime: string,
  endTime: string,
  toSlotDateTimes: (
    date: string,
    start: string,
    end: string,
  ) => { startDatetime: Date; endDatetime: Date },
  startDatetime?: Date | string | null,
  endDatetime?: Date | string | null,
): { start: Date; end: Date } {
  if (startDatetime != null && endDatetime != null) {
    return {
      start: new Date(startDatetime),
      end: new Date(endDatetime),
    };
  }
  const wall = toSlotDateTimes(itemDate, startTime, endTime);
  return { start: wall.startDatetime, end: wall.endDatetime };
}

export type OverlapCheckWindow = {
  courtKey: string;
  start: Date;
  end: Date;
  index: number;
};

export function findOverlappingItemIndices(
  windows: OverlapCheckWindow[],
): [number, number] | null {
  for (let i = 0; i < windows.length; i += 1) {
    for (let j = i + 1; j < windows.length; j += 1) {
      const a = windows[i];
      const b = windows[j];
      if (a.courtKey !== b.courtKey) continue;
      if (wallTimeWindowsOverlap(a.start, a.end, b.start, b.end)) {
        return [a.index, b.index];
      }
    }
  }
  return null;
}
