import type {
  CourtTemplateBinding,
  WeekdayKey,
} from '../types/time-slot-template.types';

const DAY_BY_INDEX: WeekdayKey[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export function weekdayKeyFromYmd(bookingDate: string): WeekdayKey {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bookingDate.trim());
  if (!m) return 'monday';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dayIndex = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).getUTCDay();
  return DAY_BY_INDEX[dayIndex] ?? 'monday';
}

export function resolveTimeSlotTemplateId(
  court: CourtTemplateBinding,
  date: string,
): string | null {
  const dayKey = weekdayKeyFromYmd(date);
  const schedule = court.timeSlotTemplateSchedule;
  if (schedule && Object.prototype.hasOwnProperty.call(schedule, dayKey)) {
    return schedule[dayKey] ?? null;
  }
  return court.timeSlotTemplateId ?? null;
}

export function courtUsesTemplateOnAnyDay(
  court: CourtTemplateBinding,
  templateId: string,
): boolean {
  if (court.timeSlotTemplateId === templateId) return true;
  const schedule = court.timeSlotTemplateSchedule;
  if (!schedule || typeof schedule !== 'object') return false;
  return Object.values(schedule).some((v) => v === templateId);
}
