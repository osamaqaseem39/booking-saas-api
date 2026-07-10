/** Normalize TypeORM getRawMany keys (Postgres lowercases unquoted aliases). */

export type BookingGridItemRow = {
  bookingId: string;
  bookingDate: string;
  bookingStatus: string;
  id: string;
  itemDate: string | null;
  startTime: string;
  endTime: string;
  startDatetime: string;
  endDatetime: string;
  itemStatus: string;
};

function pickRawString(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (v == null) continue;
    if (v instanceof Date) {
      if (!Number.isNaN(v.getTime())) return v.toISOString();
      continue;
    }
    const s = String(v).trim();
    if (s !== '') return s;
  }
  return undefined;
}

function pickRawDate(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (v == null) continue;
    if (v instanceof Date) {
      if (!Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
      continue;
    }
    const s = String(v).trim();
    if (s !== '') return s.length >= 10 ? s.slice(0, 10) : s;
  }
  return undefined;
}

function pickRawDatetime(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (v == null) continue;
    if (v instanceof Date) {
      if (!Number.isNaN(v.getTime())) return v.toISOString();
      continue;
    }
    const s = String(v).trim();
    if (s !== '') return s;
  }
  return undefined;
}

export function normalizeBookingGridItemRow(
  raw: Record<string, unknown>,
): BookingGridItemRow {
  return {
    bookingId:
      pickRawString(raw, ['bookingId', 'bookingid', 'b_id']) ?? '',
    bookingDate:
      pickRawDate(raw, ['bookingDate', 'bookingdate', 'b_bookingDate']) ?? '',
    bookingStatus:
      pickRawString(raw, ['bookingStatus', 'bookingstatus', 'b_bookingStatus']) ?? '',
    id: pickRawString(raw, ['id', 'i_id']) ?? '',
    itemDate:
      pickRawDate(raw, ['itemDate', 'itemdate', 'i_date']) ?? null,
    startTime:
      pickRawString(raw, ['startTime', 'starttime', 'i_startTime']) ?? '',
    endTime: pickRawString(raw, ['endTime', 'endtime', 'i_endTime']) ?? '',
    startDatetime:
      pickRawDatetime(raw, ['startDatetime', 'startdatetime', 'i_startDatetime']) ?? '',
    endDatetime:
      pickRawDatetime(raw, ['endDatetime', 'enddatetime', 'i_endDatetime']) ?? '',
    itemStatus:
      pickRawString(raw, ['itemStatus', 'itemstatus', 'i_itemStatus']) ?? '',
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
