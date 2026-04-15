import { Injectable } from '@nestjs/common';
import { BusinessLocation } from '../businesses/entities/business-location.entity';

type DayHours = {
  openTime: string;
  closeTime: string;
};

export type GeneratedSlot = {
  startTime: string;
  endTime: string;
  startDayOffset: number;
  endDayOffset: number;
};

const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function toMinutes(value: string): number {
  const [hRaw, mRaw] = value.split(':');
  return Number(hRaw || 0) * 60 + Number(mRaw || 0);
}

function toTime(value: number): string {
  const normalized = ((value % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

@Injectable()
export class TurfSlotGeneratorService {
  private getHoursForDate(workingHours: Record<string, any> | undefined, date: string): DayHours {
    if (!workingHours) {
      return { openTime: '00:00', closeTime: '24:00' };
    }
    const dayName = DAY_KEYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
    const row =
      workingHours[dayName] ??
      workingHours[dayName.slice(0, 3)] ??
      workingHours[String(new Date(`${date}T00:00:00Z`).getUTCDay())] ??
      null;
    if (!row || typeof row !== 'object') {
      return { openTime: '00:00', closeTime: '24:00' };
    }
    const openTime = row.open ?? row.opensAt ?? row.start ?? row.from ?? '00:00';
    const closeTime = row.close ?? row.closesAt ?? row.end ?? row.to ?? '24:00';
    return { openTime, closeTime };
  }

  generateSlots(params: {
    branch: BusinessLocation;
    bookingDate: string;
    slotDuration: number;
    bufferTime: number;
  }): GeneratedSlot[] {
    const { openTime, closeTime } = this.getHoursForDate(
      params.branch.workingHours as Record<string, any> | undefined,
      params.bookingDate,
    );
    const open = toMinutes(openTime);
    const close = closeTime === '24:00' ? 1440 : toMinutes(closeTime);
    const duration = Math.max(1, params.slotDuration);
    const step = duration + Math.max(0, params.bufferTime);
    const overnight = close <= open;
    const windowMinutes = overnight ? 1440 - open + close : close - open;
    const result: GeneratedSlot[] = [];

    for (let cursor = open; cursor + duration <= open + windowMinutes; cursor += step) {
      const startAbs = cursor;
      const endAbs = cursor + duration;
      result.push({
        startTime: toTime(startAbs),
        endTime: toTime(endAbs),
        startDayOffset: Math.floor(startAbs / 1440),
        endDayOffset: Math.floor(endAbs / 1440),
      });
    }
    return result;
  }
}
