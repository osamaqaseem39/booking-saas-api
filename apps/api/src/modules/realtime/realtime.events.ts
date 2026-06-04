export const REALTIME_NAMESPACE = 'realtime';

export const BOOKING_CHANGED_EVENT = 'booking:changed';

/** Periodic push while any booking is `live` (overtime minutes, live view). */
export const LIVE_TICK_EVENT = 'live:tick';

export type BookingRealtimeAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'payment';

export type BookingChangedPayload = {
  bookingId: string;
  action: BookingRealtimeAction;
  tenantId: string;
};

export type LiveTickPayload = {
  tenantId: string;
  at: string;
};
