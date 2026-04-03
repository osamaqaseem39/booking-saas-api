import { BadRequestException } from '@nestjs/common';

/** Same fractional digits as `bookings-dashboard` `COORDINATE_DECIMAL_PLACES`. */
export const STORED_COORDINATE_DECIMAL_PLACES = 14;

/**
 * Coerce API / JSON input and round like the dashboard before persisting.
 * Omits when value is absent; rejects non-finite numbers.
 */
export function normalizeCoordinateForPersist(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const n =
    typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) {
    throw new BadRequestException(
      'latitude and longitude must be valid finite numbers',
    );
  }
  return parseFloat(n.toFixed(STORED_COORDINATE_DECIMAL_PLACES));
}

/** Ensure list/detail JSON always exposes finite numbers (not decimal strings from old rows). */
export function coordinateToJsonNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n =
    typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}
