import {
  normalizeBookingGridItemRow,
} from './booking-grid-item-row.util';
import { bookingItemCoversFacilitySlotOnGridDate } from './slot-wall-time.util';

describe('normalizeBookingGridItemRow', () => {
  it('reads postgres-lowercased alias keys', () => {
    const row = normalizeBookingGridItemRow({
      bookingid: 'b1',
      bookingdate: '2026-06-10',
      id: 'i1',
      itemdate: '2026-06-10',
      starttime: '14:00',
      endtime: '15:00',
      startdatetime: '2026-06-10T14:00:00.000Z',
      enddatetime: '2026-06-10T15:00:00.000Z',
      itemstatus: 'confirmed',
    });
    expect(row.startTime).toBe('14:00');
    expect(row.endTime).toBe('15:00');
    expect(
      bookingItemCoversFacilitySlotOnGridDate(
        '2026-06-10',
        '14:00',
        '24:00',
        row,
        60,
      ),
    ).toBe(true);
    expect(
      bookingItemCoversFacilitySlotOnGridDate(
        '2026-06-10',
        '00:00',
        '24:00',
        row,
        60,
      ),
    ).toBe(false);
  });

  it('normalizes Date objects from postgres date columns', () => {
    const row = normalizeBookingGridItemRow({
      bookingdate: new Date('2026-07-02T00:00:00.000Z'),
      itemdate: new Date('2026-07-02T00:00:00.000Z'),
      starttime: '23:00',
      endtime: '01:00',
      startdatetime: '2026-07-02T23:00:00.000Z',
      enddatetime: '2026-07-03T01:00:00.000Z',
    });
    expect(row.bookingDate).toBe('2026-07-02');
    expect(row.itemDate).toBe('2026-07-02');
    expect(() =>
      bookingItemCoversFacilitySlotOnGridDate(
        '2026-07-02',
        '23:00',
        '24:00',
        row,
        60,
      ),
    ).not.toThrow();
    expect(
      bookingItemCoversFacilitySlotOnGridDate(
        '2026-07-02',
        '23:00',
        '24:00',
        row,
        60,
      ),
    ).toBe(true);
  });

  it('empty raw row does not cover the whole day', () => {
    const row = normalizeBookingGridItemRow({});
    expect(
      bookingItemCoversFacilitySlotOnGridDate(
        '2026-06-10',
        '00:00',
        '24:00',
        row,
        60,
      ),
    ).toBe(false);
  });
});
