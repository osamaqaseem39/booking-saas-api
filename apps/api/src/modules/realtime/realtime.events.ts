export const REALTIME_NAMESPACE = 'realtime';

export const BOOKING_CHANGED_EVENT = 'booking:changed';

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
