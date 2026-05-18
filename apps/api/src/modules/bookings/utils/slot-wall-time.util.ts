/** Wall-clock slot helpers shared by bookings + facility-slot sync. */

export const DEFAULT_SLOT_STEP_MINUTES = 60;

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
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

export function addDaysYmdWall(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
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
 * Booking item `endTime` when stored as `24:00`.
 * Before 17:00 means one step; 17:00+ means play until close.
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

export function buildItemFacilitySlotSyncWindows(
  item: { date?: string | null; startTime: string; endTime: string },
  bookingDate: string,
  slotStepMinutes = DEFAULT_SLOT_STEP_MINUTES,
): Array<{ slotDate: string; windowStart: string; windowEnd: string }> {
  const date = formatDateOnlyYmd(item.date ?? bookingDate);
  const effectiveEnd = wallSlotEffectiveEndTime(
    item.startTime,
    item.endTime,
    slotStepMinutes,
  );
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
