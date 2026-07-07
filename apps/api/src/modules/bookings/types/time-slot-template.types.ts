export type SlotPriceTier = 'standard' | 'peak';

export type WeekdayKey =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export const WEEKDAY_KEYS: WeekdayKey[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export type TimeSlotTemplateSchedule = Partial<
  Record<WeekdayKey, string | null>
>;

export type CourtTemplateBinding = {
  timeSlotTemplateId?: string | null;
  timeSlotTemplateSchedule?: TimeSlotTemplateSchedule | null;
};
