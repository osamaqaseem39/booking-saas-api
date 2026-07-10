import { buildPlaySnapshot } from './facility-live-snapshot.util';
import type { Booking } from '../entities/booking.entity';
import type { BookingItem } from '../entities/booking-item.entity';

function makeBooking(
  overrides: Partial<Booking> & { items: BookingItem[] },
): Booking {
  const { items, ...rest } = overrides;
  return {
    id: 'b1',
    bookingStatus: 'live',
    bookingDate: '2026-07-10',
    sportType: 'padel',
    totalAmount: '1000',
    discount: '0',
    paidAmount: '0',
    user: { fullName: 'Overtime Guest' } as Booking['user'],
    items,
    ...rest,
  } as Booking;
}

function makeItem(
  overrides: Partial<BookingItem> & {
    startTime: string;
    endTime: string;
  },
): BookingItem {
  return {
    id: overrides.id ?? 'item-1',
    courtId: 'court-1',
    courtKind: 'padel_court',
    itemStatus: 'confirmed',
    date: '2026-07-10',
    price: '500',
    ...overrides,
  } as BookingItem;
}

describe('buildPlaySnapshot', () => {
  const now = new Date('2026-07-10T11:08:00.000Z'); // 16:08 PKT

  it('treats a live booking as current during a gap between item segments', () => {
    const booking = makeBooking({
      items: [
        makeItem({ id: 'i1', startTime: '14:00', endTime: '15:00' }),
        makeItem({ id: 'i2', startTime: '17:00', endTime: '21:30' }),
      ],
    });

    const snap = buildPlaySnapshot([booking], 'padel_court', 'court-1', 'Padel 1', {
      timeZone: 'Asia/Karachi',
      now,
      facilityActive: true,
      statusRaw: 'active',
    });

    expect(snap.playStatus).toBe('live');
    expect(snap.currentBooking?.bookingId).toBe('b1');
    expect(snap.currentBooking?.startTime).toBe('14:00');
    expect(snap.currentBooking?.endTime).toBe('21:30');
    expect(snap.nextBooking).toBeNull();
  });

  it('does not show a live booking under up next', () => {
    const booking = makeBooking({
      items: [
        makeItem({ id: 'i1', startTime: '14:00', endTime: '15:00' }),
        makeItem({ id: 'i2', startTime: '17:00', endTime: '21:30' }),
      ],
    });
    const other = makeBooking({
      id: 'b2',
      bookingStatus: 'confirmed',
      items: [
        makeItem({
          id: 'i3',
          startTime: '22:00',
          endTime: '23:00',
        }),
      ],
    });

    const snap = buildPlaySnapshot(
      [booking, other],
      'padel_court',
      'court-1',
      'Padel 1',
      {
        timeZone: 'Asia/Karachi',
        now,
        facilityActive: true,
        statusRaw: 'active',
      },
    );

    expect(snap.currentBooking?.bookingId).toBe('b1');
    expect(snap.nextBooking?.bookingId).toBe('b2');
  });
});
