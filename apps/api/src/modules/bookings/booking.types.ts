export const BOOKING_SPORT_TYPES = ['futsal', 'cricket', 'padel'] as const;
export type BookingSportType = (typeof BOOKING_SPORT_TYPES)[number];

export const BOOKING_ITEM_STATUSES = [
  'reserved',
  'confirmed',
  'cancelled',
] as const;
export type BookingItemStatus = (typeof BOOKING_ITEM_STATUSES)[number];

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'paid',
  'failed',
  'refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = [
  'cash',
  'card',
  'jazzcash',
  'easypaisa',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Which physical court table `courtId` refers to */
export const COURT_KINDS = [
  'turf_court',
  'futsal_field',
  'padel_court',
  'cricket_indoor_court',
] as const;
export type CourtKind = (typeof COURT_KINDS)[number];
