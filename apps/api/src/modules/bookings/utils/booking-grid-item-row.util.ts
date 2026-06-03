/** Normalize TypeORM getRawMany keys (Postgres lowercases unquoted aliases). */

export type BookingGridItemRow = {
  bookingId: string;
  bookingDate: string;
  id: string;
  itemDate: string | null;
  startTime: string;
  endTime: string;
  startDatetime: string;
  endDatetime: string;
  itemStatus: string;
};

function pickRaw(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (v != null && String(v).trim() !== '') return String(v);
  }
  return undefined;
}

export function normalizeBookingGridItemRow(
  raw: Record<string, unknown>,
): BookingGridItemRow {
  return {
    bookingId:
      pickRaw(raw, ['bookingId', 'bookingid', 'b_id']) ?? '',
    bookingDate:
      pickRaw(raw, ['bookingDate', 'bookingdate', 'b_bookingDate']) ?? '',
    id: pickRaw(raw, ['id', 'i_id']) ?? '',
    itemDate:
      pickRaw(raw, ['itemDate', 'itemdate', 'i_date']) ?? null,
    startTime:
      pickRaw(raw, ['startTime', 'starttime', 'i_startTime']) ?? '',
    endTime: pickRaw(raw, ['endTime', 'endtime', 'i_endTime']) ?? '',
    startDatetime:
      pickRaw(raw, ['startDatetime', 'startdatetime', 'i_startDatetime']) ?? '',
    endDatetime:
      pickRaw(raw, ['endDatetime', 'enddatetime', 'i_endDatetime']) ?? '',
    itemStatus:
      pickRaw(raw, ['itemStatus', 'itemstatus', 'i_itemStatus']) ?? '',
  };
}

export function normalizeBookingGridItemRows(
  rawRows: Record<string, unknown>[],
): BookingGridItemRow[] {
  return rawRows
    .map((r) => normalizeBookingGridItemRow(r))
    .filter(
      (r) =>
        r.startTime.includes(':') &&
        r.endTime.includes(':') &&
        r.startDatetime.length > 0 &&
        r.endDatetime.length > 0,
    );
}
