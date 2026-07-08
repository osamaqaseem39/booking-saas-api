import {
  addDaysYmdWall,
  bookingItemCoversFacilitySlotOnGridDate,
  buildItemFacilitySlotSyncWindows,
  facilitySlotEffectiveEndTime,
  facilitySlotMarkingWallEnd,
  facilitySlotOverlapsBookingItem,
  facilitySlotOverlapsWallWindow,
  facilitySlotStartInMarkWindow,
  filterSlotsForBookingPicker,
  formatDateOnlyYmd,
  resolveBookingMatchEndTime,
  wallSlotEffectiveEndTime,
} from './slot-wall-time.util';

describe('slot-wall-time.util', () => {
  it('formatDateOnlyYmd handles Date objects and ISO strings', () => {
    expect(formatDateOnlyYmd(new Date('2026-07-02T00:00:00.000Z'))).toBe(
      '2026-07-02',
    );
    expect(formatDateOnlyYmd('2026-07-02')).toBe('2026-07-02');
    expect(formatDateOnlyYmd('')).toBe('');
  });

  it('addDaysYmdWall throws InvalidWallDateError on invalid input', () => {
    expect(() => addDaysYmdWall('', 1)).toThrow(
      'Invalid booking grid date during addDaysYmdWall: expected YYYY-MM-DD, received ""',
    );
    expect(addDaysYmdWall('2026-07-02', 1)).toBe('2026-07-03');
  });
  it('maps facility row 08:00–24:00 to one hour for overlap', () => {
    expect(facilitySlotEffectiveEndTime('08:00', '24:00', 60)).toBe('09:00');
    expect(wallSlotEffectiveEndTime('08:00', '24:00', 60)).toBe('09:00');
  });

  it('facilitySlotMarkingWallEnd uses datetime wall end for short 20:00–24:00 items', () => {
    expect(
      facilitySlotMarkingWallEnd(
        {
          startTime: '20:00',
          endTime: '24:00',
          startDatetime: '2026-06-06T20:00:00.000Z',
          endDatetime: '2026-06-06T21:00:00.000Z',
        },
        60,
      ),
    ).toBe('21:00');
  });

  it('resolveBookingMatchEndTime uses one hour for short 19:00–24:00 items', () => {
    expect(
      resolveBookingMatchEndTime(
        {
          startTime: '19:00',
          endTime: '24:00',
          startDatetime: '2026-05-18T19:00:00.000Z',
          endDatetime: '2026-05-18T20:00:00.000Z',
        },
        60,
      ),
    ).toBe('20:00');
  });

  it('facilitySlotOverlapsBookingItem matches only the booked hour', () => {
    const item = {
      startTime: '19:00',
      endTime: '20:00',
      startDatetime: '2026-05-18T19:00:00.000Z',
      endDatetime: '2026-05-18T20:00:00.000Z',
    };
    expect(
      facilitySlotOverlapsBookingItem('19:00', '24:00', item, 60),
    ).toBe(true);
    expect(
      facilitySlotOverlapsBookingItem('18:00', '24:00', item, 60),
    ).toBe(false);
  });

  it('booking 19:00–20:00 does not overlap earlier hourly facility rows ending 24:00', () => {
    expect(
      facilitySlotOverlapsWallWindow('18:00', '24:00', '19:00', '20:00', 60),
    ).toBe(false);
    expect(
      facilitySlotOverlapsWallWindow('19:00', '24:00', '19:00', '20:00', 60),
    ).toBe(true);
  });

  it('booking 08:00–09:00 does not overlap facility row 09:00–24:00', () => {
    expect(
      facilitySlotOverlapsWallWindow('09:00', '24:00', '08:00', '09:00', 60),
    ).toBe(false);
  });

  it('booking 08:00–09:00 overlaps facility row 08:00–24:00', () => {
    expect(
      facilitySlotOverlapsWallWindow('08:00', '24:00', '08:00', '09:00', 60),
    ).toBe(true);
  });

  it('booking 00:00–01:00 only overlaps first facility row ending at 24:00', () => {
    expect(
      facilitySlotOverlapsWallWindow('00:00', '24:00', '00:00', '01:00', 60),
    ).toBe(true);
    expect(
      facilitySlotOverlapsWallWindow('01:00', '24:00', '00:00', '01:00', 60),
    ).toBe(false);
  });

  it('buildItemFacilitySlotSyncWindows for 01:00–24:00 item is one hour', () => {
    expect(
      buildItemFacilitySlotSyncWindows(
        { date: '2026-05-19', startTime: '01:00', endTime: '24:00' },
        '2026-05-19',
        60,
      ),
    ).toEqual([
      {
        slotDate: '2026-05-19',
        windowStart: '01:00',
        windowEnd: '02:00',
      },
    ]);
  });

  it('one-hour 14:00 booking does not cover the whole day on the grid', () => {
    const item = {
      itemDate: '2026-06-01',
      bookingDate: '2026-06-01',
      startTime: '14:00',
      endTime: '15:00',
      startDatetime: '2026-06-01T14:00:00.000Z',
      endDatetime: '2026-06-01T15:00:00.000Z',
    };
    expect(
      bookingItemCoversFacilitySlotOnGridDate(
        '2026-06-01',
        '14:00',
        '24:00',
        item,
        60,
      ),
    ).toBe(true);
    expect(
      bookingItemCoversFacilitySlotOnGridDate(
        '2026-06-01',
        '08:00',
        '24:00',
        item,
        60,
      ),
    ).toBe(false);
    expect(
      bookingItemCoversFacilitySlotOnGridDate(
        '2026-06-01',
        '18:00',
        '24:00',
        item,
        60,
      ),
    ).toBe(false);
  });

  it('short evening booking with endTime 24:00 only covers one hour', () => {
    const item = {
      itemDate: '2026-06-01',
      bookingDate: '2026-06-01',
      startTime: '19:00',
      endTime: '24:00',
      startDatetime: '2026-06-01T19:00:00.000Z',
      endDatetime: '2026-06-01T20:00:00.000Z',
    };
    expect(
      bookingItemCoversFacilitySlotOnGridDate(
        '2026-06-01',
        '19:00',
        '24:00',
        item,
        60,
      ),
    ).toBe(true);
    expect(
      bookingItemCoversFacilitySlotOnGridDate(
        '2026-06-01',
        '20:00',
        '24:00',
        item,
        60,
      ),
    ).toBe(false);
    expect(
      bookingItemCoversFacilitySlotOnGridDate(
        '2026-06-01',
        '14:00',
        '24:00',
        item,
        60,
      ),
    ).toBe(false);
  });

  it('facilitySlotStartInMarkWindow marks only rows starting inside the window', () => {
    expect(facilitySlotStartInMarkWindow('14:00', '14:00', '15:00')).toBe(true);
    expect(facilitySlotStartInMarkWindow('15:00', '14:00', '15:00')).toBe(false);
    expect(facilitySlotStartInMarkWindow('13:00', '14:00', '15:00')).toBe(false);
  });

  it('23:00–24:00 one-hour booking does not cover earlier 17:00–24:00 template rows', () => {
    const item = {
      itemDate: '2026-06-03',
      bookingDate: '2026-06-03',
      startTime: '23:00',
      endTime: '24:00',
      startDatetime: '2026-06-03T23:00:00.000Z',
      endDatetime: '2026-06-04T00:00:00.000Z',
    };
    expect(
      bookingItemCoversFacilitySlotOnGridDate(
        '2026-06-03',
        '23:00',
        '24:00',
        item,
        60,
      ),
    ).toBe(true);
    for (const start of ['17:00', '18:00', '19:00', '20:00', '21:00', '22:00']) {
      expect(
        bookingItemCoversFacilitySlotOnGridDate(
          '2026-06-03',
          start,
          '24:00',
          item,
          60,
        ),
      ).toBe(false);
    }
  });

  it('filterSlotsForBookingPicker hides ended slots on today', () => {
    const slots = [
      { startTime: '14:00', endTime: '15:00' },
      { startTime: '18:00', endTime: '19:00' },
    ];
    const now = new Date('2026-06-03T16:00:00+05:00');
    expect(
      filterSlotsForBookingPicker(slots, '2026-06-03', now, 'Asia/Karachi'),
    ).toEqual([{ startTime: '18:00', endTime: '19:00' }]);
  });

  it('filterSlotsForBookingPicker keeps the in-progress hour after :29', () => {
    const slots = [
      { startTime: '14:00', endTime: '15:00' },
      { startTime: '15:00', endTime: '16:00' },
      { startTime: '16:00', endTime: '17:00' },
    ];
    const now = new Date('2026-06-03T15:45:00+05:00');
    expect(
      filterSlotsForBookingPicker(slots, '2026-06-03', now, 'Asia/Karachi'),
    ).toEqual([
      { startTime: '15:00', endTime: '16:00' },
      { startTime: '16:00', endTime: '17:00' },
    ]);
  });
});
