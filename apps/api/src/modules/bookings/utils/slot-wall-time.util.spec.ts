import {
  buildItemFacilitySlotSyncWindows,
  facilitySlotEffectiveEndTime,
  facilitySlotOverlapsWallWindow,
  wallSlotEffectiveEndTime,
} from './slot-wall-time.util';

describe('slot-wall-time.util', () => {
  it('maps facility row 08:00–24:00 to one hour for overlap', () => {
    expect(facilitySlotEffectiveEndTime('08:00', '24:00', 60)).toBe('09:00');
    expect(wallSlotEffectiveEndTime('08:00', '24:00', 60)).toBe('09:00');
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
});
