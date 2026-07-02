/** Wall-clock slot helpers shared by bookings + facility-slot sync. */

export const DEFAULT_SLOT_STEP_MINUTES = 60;
export const DEFAULT_BOOKING_GRID_TZ = 'Asia/Karachi';

export function bookingGridTodayYmd(
  now = new Date(),
  timeZone = DEFAULT_BOOKING_GRID_TZ,
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export function bookingGridNowParts(
  now = new Date(),
  timeZone = DEFAULT_BOOKING_GRID_TZ,
): { hour: number; minute: number; timeStr: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return { hour: Number(hh), minute: Number(mm), timeStr: `${hh}:${mm}` };
}

/** Hide elapsed slots for “today”; hide current hour after minute 29 (picker rule). */
export function filterSlotsForBookingPicker<T extends { startTime: string; endTime: string }>(
  slots: T[],
  date: string,
  now = new Date(),
  timeZone = DEFAULT_BOOKING_GRID_TZ,
): T[] {
  const todayStr = bookingGridTodayYmd(now, timeZone);
  if (date < todayStr) return [];
  if (date > todayStr) return slots;

  const { hour, minute, timeStr: currentTimeStr } = bookingGridNowParts(now, timeZone);
  let filtered = slots.filter((s) => s.endTime > currentTimeStr);
  if (minute > 29) {
    const currentHourStart = hour * 60;
    const nextHourStart = (hour + 1) * 60;
    filtered = filtered.filter((s) => {
      const slotStart = wallToMinutes(s.startTime, false);
      return slotStart < currentHourStart || slotStart >= nextHourStart;
    });
  }
  return filtered;
}

export function wallToMinutes(time: string, isEndTime = false): number {
  if (typeof time !== 'string' || !time.includes(':')) return 0;
  if (time === '24:00' || (time === '00:00' && isEndTime)) return 24 * 60;
  const [hRaw, mRaw] = time.split(':');
  return Number(hRaw || 0) * 60 + Number(mRaw || 0);
}

export function wallMinutesToTime(m: number): string {
  if (m >= 24 * 60) return '24:00';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function formatDateOnlyYmd(d: Date | string): string {
  if (d instanceof Date) {
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (!s) return '';
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
}

export function addDaysYmdWall(date: string, days: number): string {
  const ymd = formatDateOnlyYmd(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const d = new Date(`${ymd}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Facility grid rows ending at `24:00` always mean one step, not close-of-day. */
export function facilitySlotEffectiveEndTime(
  startTime: string,
  endTime: string,
  slotStepMinutes = DEFAULT_SLOT_STEP_MINUTES,
): string {
  if (endTime !== '24:00') return endTime;
  const startMin = wallToMinutes(startTime, false);
  return wallMinutesToTime(Math.min(startMin + slotStepMinutes, 24 * 60));
}

/**
 * @deprecated Use `resolveBookingMatchEndTime` (duration from datetimes, else one grid step).
 * Legacy: 17:00+ with `endTime` 24:00 meant play-until-close without datetimes.
 */
export function wallSlotEffectiveEndTime(
  startTime: string,
  endTime: string,
  slotStepMinutes = DEFAULT_SLOT_STEP_MINUTES,
): string {
  if (endTime !== '24:00') return endTime;
  const startMin = wallToMinutes(startTime, false);
  if (startMin >= 17 * 60) return '24:00';
  return wallMinutesToTime(Math.min(startMin + slotStepMinutes, 24 * 60));
}

export function wallSlotOverlapsWindow(
  slotStart: string,
  slotEnd: string,
  windowStart: string,
  windowEnd: string,
): boolean {
  return (
    wallToMinutes(slotStart, false) < wallToMinutes(windowEnd, true) &&
    wallToMinutes(slotEnd, true) > wallToMinutes(windowStart, false)
  );
}

/** Wall-clock end for marking `court_facility_slots` (never wider than real play time). */
export function facilitySlotMarkingWallEnd(
  item: {
    startTime: string;
    endTime: string;
    startDatetime?: Date | string | null;
    endDatetime?: Date | string | null;
  },
  slotStepMinutes = DEFAULT_SLOT_STEP_MINUTES,
  graceMinutes = 15,
): string {
  if (item.endTime !== '24:00') {
    return item.endTime;
  }
  if (item.startDatetime != null && item.endDatetime != null) {
    const durationMin =
      (new Date(item.endDatetime).getTime() -
        new Date(item.startDatetime).getTime()) /
      60000;
    if (durationMin > slotStepMinutes + graceMinutes) {
      return '24:00';
    }
    const dtEnd = new Date(item.endDatetime).toISOString().slice(11, 16);
    if (dtEnd !== '00:00') {
      return dtEnd;
    }
  }
  return facilitySlotEffectiveEndTime(
    item.startTime,
    item.endTime,
    slotStepMinutes,
  );
}

/** Wall-clock end used when matching a booking item to facility grid rows. */
export function resolveBookingMatchEndTime(
  item: {
    startTime: string;
    endTime: string;
    startDatetime?: Date | string | null;
    endDatetime?: Date | string | null;
  },
  slotStepMinutes = DEFAULT_SLOT_STEP_MINUTES,
  graceMinutes = 15,
): string {
  if (item.endTime !== '24:00') return item.endTime;
  if (item.startDatetime != null && item.endDatetime != null) {
    const durationMin =
      (new Date(item.endDatetime).getTime() -
        new Date(item.startDatetime).getTime()) /
      60000;
    if (durationMin > slotStepMinutes + graceMinutes) {
      return '24:00';
    }
    const dtEnd = new Date(item.endDatetime).toISOString().slice(11, 16);
    if (dtEnd === '00:00') {
      return wallMinutesToTime(
        Math.min(
          wallToMinutes(item.startTime, false) + Math.round(durationMin),
          24 * 60,
        ),
      );
    }
    return dtEnd;
  }
  return facilitySlotEffectiveEndTime(
    item.startTime,
    item.endTime,
    slotStepMinutes,
  );
}

export function facilitySlotOverlapsBookingItem(
  slotStart: string,
  slotEnd: string,
  item: {
    startTime: string;
    endTime: string;
    startDatetime?: Date | string | null;
    endDatetime?: Date | string | null;
  },
  slotStepMinutes = DEFAULT_SLOT_STEP_MINUTES,
  graceMinutes = 15,
): boolean {
  const matchEnd = resolveBookingMatchEndTime(
    item,
    slotStepMinutes,
    graceMinutes,
  );
  return facilitySlotOverlapsWallWindow(
    slotStart,
    slotEnd,
    item.startTime,
    matchEnd,
    slotStepMinutes,
  );
}

/** Facility row is marked when its start time falls in [windowStart, windowEnd). */
export function facilitySlotStartInMarkWindow(
  slotStart: string,
  windowStart: string,
  windowEnd: string,
): boolean {
  const s = wallToMinutes(slotStart, false);
  const w0 = wallToMinutes(windowStart, false);
  const w1 = wallToMinutes(windowEnd, true);
  return s >= w0 && s < w1;
}

/** Match a facility grid row (often `endTime: 24:00`) to a booking block window. */
export function facilitySlotOverlapsWallWindow(
  slotStart: string,
  slotEnd: string,
  windowStart: string,
  windowEnd: string,
  slotStepMinutes = DEFAULT_SLOT_STEP_MINUTES,
): boolean {
  const slotEndEffective = facilitySlotEffectiveEndTime(
    slotStart,
    slotEnd,
    slotStepMinutes,
  );
  return wallSlotOverlapsWindow(
    slotStart,
    slotEndEffective,
    windowStart,
    windowEnd,
  );
}

function hasPersistedWallDatetimes(
  item: {
    startDatetime?: Date | string | null;
    endDatetime?: Date | string | null;
  },
): boolean {
  const s = item.startDatetime;
  const e = item.endDatetime;
  if (s == null || e == null) return false;
  const ss = s instanceof Date ? s.toISOString() : String(s).trim();
  const ee = e instanceof Date ? e.toISOString() : String(e).trim();
  return ss.length > 0 && ee.length > 0 && !Number.isNaN(new Date(ss).getTime());
}

function isValidWallStartTime(startTime: string): boolean {
  return typeof startTime === 'string' && startTime.includes(':');
}

/** Wall-clock windows for an item on a single grid day (no datetime expansion to close). */
export function bookingItemWindowsOnGridDate(
  gridDate: string,
  item: {
    itemDate?: string | null;
    bookingDate?: string;
    startTime: string;
    endTime: string;
    startDatetime?: Date | string | null;
    endDatetime?: Date | string | null;
  },
  slotStepMinutes = DEFAULT_SLOT_STEP_MINUTES,
): Array<{ windowStart: string; windowEnd: string }> {
  if (!isValidWallStartTime(item.startTime)) return [];

  const anchorDate =
    formatDateOnlyYmd(item.itemDate || item.bookingDate || gridDate) ||
    formatDateOnlyYmd(item.startDatetime ?? '') ||
    gridDate;
  const wallEnd = hasPersistedWallDatetimes(item)
    ? resolveBookingMatchEndTime(item, slotStepMinutes)
    : item.endTime;
  const windows = buildItemFacilitySlotSyncWindows(
    { date: anchorDate, startTime: item.startTime, endTime: wallEnd },
    anchorDate,
    slotStepMinutes,
  );
  const onGrid = windows
    .filter((w) => w.slotDate === gridDate)
    .map((w) => ({ windowStart: w.windowStart, windowEnd: w.windowEnd }));
  if (onGrid.length) return onGrid;

  if (!hasPersistedWallDatetimes(item)) return [];

  const startIso =
    item.startDatetime instanceof Date
      ? item.startDatetime.toISOString()
      : String(item.startDatetime);
  const endIso =
    item.endDatetime instanceof Date
      ? item.endDatetime.toISOString()
      : String(item.endDatetime);

  const dayStart = new Date(`${gridDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${addDaysYmdWall(gridDate, 1)}T00:00:00.000Z`);
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (start >= dayEnd || end <= dayStart) return [];

  const clipStart = start > dayStart ? start : dayStart;
  const clipEnd = end < dayEnd ? end : dayEnd;
  const windowStart = clipStart.toISOString().slice(11, 16);
  let windowEnd = clipEnd.toISOString().slice(11, 16);
  if (windowEnd === '00:00' && clipEnd.getTime() === dayEnd.getTime()) {
    windowEnd = '24:00';
  }

  return buildItemFacilitySlotSyncWindows(
    { date: gridDate, startTime: windowStart, endTime: windowEnd },
    gridDate,
    slotStepMinutes,
  )
    .filter((w) => w.slotDate === gridDate)
    .map((w) => ({ windowStart: w.windowStart, windowEnd: w.windowEnd }));
}

export function bookingItemCoversFacilitySlotOnGridDate(
  gridDate: string,
  slotStart: string,
  slotEnd: string,
  item: {
    itemDate?: string | null;
    bookingDate?: string;
    startTime: string;
    endTime: string;
    startDatetime?: Date | string | null;
    endDatetime?: Date | string | null;
  },
  slotStepMinutes = DEFAULT_SLOT_STEP_MINUTES,
): boolean {
  const windows = bookingItemWindowsOnGridDate(gridDate, item, slotStepMinutes);
  for (const w of windows) {
    if (facilitySlotStartInMarkWindow(slotStart, w.windowStart, w.windowEnd)) {
      return true;
    }
  }
  return false;
}

export function buildItemFacilitySlotSyncWindows(
  item: {
    date?: string | null;
    startTime: string;
    endTime: string;
    startDatetime?: Date | string | null;
    endDatetime?: Date | string | null;
    /** When true, `endTime` is already the marking wall end (do not re-expand). */
    useMarkingWallEnd?: boolean;
  },
  bookingDate: string,
  slotStepMinutes = DEFAULT_SLOT_STEP_MINUTES,
): Array<{ slotDate: string; windowStart: string; windowEnd: string }> {
  const date =
    formatDateOnlyYmd(item.date || bookingDate) ||
    formatDateOnlyYmd(item.startDatetime ?? '') ||
    bookingDate;
  const effectiveEnd = item.useMarkingWallEnd
    ? item.endTime
    : item.startDatetime != null && item.endDatetime != null
      ? resolveBookingMatchEndTime(
          {
            startTime: item.startTime,
            endTime: item.endTime,
            startDatetime: item.startDatetime,
            endDatetime: item.endDatetime,
          },
          slotStepMinutes,
        )
      : item.endTime === '24:00'
        ? wallSlotEffectiveEndTime(
            item.startTime,
            item.endTime,
            slotStepMinutes,
          )
        : item.endTime;
  if (
    typeof item.startTime !== 'string' ||
    !item.startTime.includes(':') ||
    wallToMinutes(item.startTime, false) >= 24 * 60
  ) {
    return [];
  }
  const startMin = wallToMinutes(item.startTime, false);
  const endMin = wallToMinutes(effectiveEnd, true);
  if (endMin <= startMin) {
    return [
      {
        slotDate: date,
        windowStart: wallMinutesToTime(startMin),
        windowEnd: '24:00',
      },
      {
        slotDate: addDaysYmdWall(date, 1),
        windowStart: '00:00',
        windowEnd: wallMinutesToTime(endMin),
      },
    ];
  }
  return [
    {
      slotDate: date,
      windowStart: wallMinutesToTime(startMin),
      windowEnd: wallMinutesToTime(endMin),
    },
  ];
}
