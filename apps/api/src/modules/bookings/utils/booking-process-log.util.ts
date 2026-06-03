import { Logger } from '@nestjs/common';
import { resolveBookingMatchEndTime } from './slot-wall-time.util';

const PREFIX = '[BookingProcess]';

export function bookingProcessLogEnabled(): boolean {
  const v = process.env.BOOKING_PROCESS_LOG;
  return v !== 'false' && v !== '0';
}

type SlotLike = {
  startTime: string;
  endTime: string;
  availability?: string;
  state?: string;
};

export function summarizeSlotAvailability(slots: SlotLike[]) {
  let availableCount = 0;
  let bookedCount = 0;
  let blockedCount = 0;
  for (const s of slots) {
    const a = s.state ?? s.availability;
    if (a === 'free' || a === 'available') availableCount += 1;
    else if (a === 'booked') bookedCount += 1;
    else if (a === 'blocked') blockedCount += 1;
  }
  return {
    segmentCount: slots.length,
    availableCount,
    bookedCount,
    blockedCount,
    sample: slots.slice(0, 8).map((s) => ({
      start: s.startTime,
      end: s.endTime,
      state: s.state ?? s.availability,
    })),
  };
}

export function summarizeActiveBookingItems(
  rows: Array<{
    bookingId: string;
    startTime: string;
    endTime: string;
    startDatetime: string;
    endDatetime: string;
  }>,
  slotStepMinutes: number,
) {
  return rows.slice(0, 12).map((r) => ({
    bookingId: r.bookingId,
    start: r.startTime,
    end: r.endTime,
    matchEnd: resolveBookingMatchEndTime(
      {
        startTime: r.startTime,
        endTime: r.endTime,
        startDatetime: r.startDatetime,
        endDatetime: r.endDatetime,
      },
      slotStepMinutes,
    ),
  }));
}

export function summarizeCreateItems(
  items: Array<{
    courtKind?: string;
    courtId?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    startDatetime?: Date;
    endDatetime?: Date;
  }>,
) {
  return items.map((i, idx) => ({
    idx,
    courtKind: i.courtKind,
    courtId: i.courtId,
    date: i.date,
    start: i.startTime,
    end: i.endTime,
    startDatetime: i.startDatetime?.toISOString?.() ?? i.startDatetime,
    endDatetime: i.endDatetime?.toISOString?.() ?? i.endDatetime,
  }));
}

export function bookingProcessStep(
  logger: Logger,
  step: string,
  meta: Record<string, unknown>,
): void {
  if (!bookingProcessLogEnabled()) return;
  logger.log(`${PREFIX} ${step} ${JSON.stringify(meta)}`);
}

export function bookingProcessWarn(
  logger: Logger,
  step: string,
  meta: Record<string, unknown>,
): void {
  if (!bookingProcessLogEnabled()) return;
  logger.warn(`${PREFIX} ${step} ${JSON.stringify(meta)}`);
}

export function bookingProcessError(
  logger: Logger,
  step: string,
  err: unknown,
  meta: Record<string, unknown> = {},
): void {
  if (!bookingProcessLogEnabled()) return;
  const message = err instanceof Error ? err.message : String(err);
  logger.error(
    `${PREFIX} ${step} ${JSON.stringify({ ...meta, error: message })}`,
    err instanceof Error ? err.stack : undefined,
  );
}
