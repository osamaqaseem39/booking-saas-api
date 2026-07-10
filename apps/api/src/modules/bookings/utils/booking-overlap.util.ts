import {
  DEFAULT_BOOKING_GRID_TZ,
  wallInstantToStoredDate,
} from './slot-wall-time.util';

export function timeHmForOverlap(t: string): string {
  return (t ?? '').trim().slice(0, 5);
}

/** End of the last contiguous booked segment (for +30/+60 min extensions). */
export function contiguousBookedWallEnd(
  items: Array<{
    startTime: string;
    endTime: string;
    date?: string | Date | null;
    itemStatus?: string;
  }>,
  bookingDate: string,
  toSlotDateTimes: (
    date: string,
    start: string,
    end: string,
  ) => { startDatetime: Date; endDatetime: Date },
): Date {
  const active = items
    .filter((i) => i.itemStatus !== 'cancelled')
    .sort((a, b) => {
      const ad = String(a.date ?? bookingDate).slice(0, 10);
      const bd = String(b.date ?? bookingDate).slice(0, 10);
      const d = ad.localeCompare(bd);
      if (d !== 0) return d;
      return a.startTime.localeCompare(b.startTime);
    });
  if (!active.length) {
    throw new Error('contiguousBookedWallEnd: no active items');
  }
  let lastEnd = toSlotDateTimes(
    String(active[0]!.date ?? bookingDate).slice(0, 10),
    active[0]!.startTime,
    active[0]!.endTime,
  ).endDatetime;
  for (let i = 1; i < active.length; i += 1) {
    const prev = active[i - 1]!;
    const cur = active[i]!;
    if (timeHmForOverlap(prev.endTime) !== timeHmForOverlap(cur.startTime)) break;
    lastEnd = toSlotDateTimes(
      String(cur.date ?? bookingDate).slice(0, 10),
      cur.startTime,
      cur.endTime,
    ).endDatetime;
  }
  return lastEnd;
}

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
  timeZone = DEFAULT_BOOKING_GRID_TZ,
): Date {
  if (bookingStatus !== 'live') return endDatetime;
  const nowStored = wallInstantToStoredDate(now, timeZone);
  return new Date(Math.max(endDatetime.getTime(), nowStored.getTime()));
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
