/** Supported location kinds for dashboard setup. */
export const BUSINESS_LOCATION_TYPE_CODES = [
  'arena',
  'gaming-zone',
  'snooker',
  'table-tennis',
] as const;

export type BusinessLocationTypeCode =
  (typeof BUSINESS_LOCATION_TYPE_CODES)[number];

/** Canonical arena sub-facility codes stored on locations (API + persist). */
export const BUSINESS_LOCATION_FACILITY_TYPE_CODES = [
  'futsal',
  'cricket',
  'padel',
] as const;

export type BusinessLocationFacilityTypeCode =
  (typeof BUSINESS_LOCATION_FACILITY_TYPE_CODES)[number];

/** Accepted on create/update; normalized to canonical codes before persist. */
export const BUSINESS_LOCATION_FACILITY_LEGACY_TYPE_CODES = [
  'turf-court',
  'turf-court-futsal',
  'turf-court-cricket',
  'futsal-field',
  'cricket-indoor',
  'padel-court',
] as const;

export const ALL_ACCEPTED_BUSINESS_LOCATION_FACILITY_CODES = [
  ...BUSINESS_LOCATION_FACILITY_TYPE_CODES,
  ...BUSINESS_LOCATION_FACILITY_LEGACY_TYPE_CODES,
] as const;

/**
 * Normalize location facility type tags to `futsal` | `cricket` | `padel`.
 */
export function normalizeLocationFacilityTypesForApi(
  raw: string[] | null | undefined,
): string[] {
  if (!raw?.length) return [];
  const out = new Set<string>();
  for (const t of raw) {
    if (
      t === 'futsal-field' ||
      t === 'turf-court-futsal' ||
      t === 'futsal'
    ) {
      out.add('futsal');
    } else if (
      t === 'cricket-indoor' ||
      t === 'turf-court-cricket' ||
      t === 'cricket'
    ) {
      out.add('cricket');
    } else if (t === 'padel-court' || t === 'padel') {
      out.add('padel');
    } else if (t === 'turf-court') {
      out.add('futsal');
      out.add('cricket');
    }
  }
  return [...out].sort();
}

/** Same expansion as API normalization; use when persisting location facilityTypes. */
export function normalizeLocationFacilityTypesForPersist(
  raw: string[] | null | undefined,
): string[] {
  return normalizeLocationFacilityTypesForApi(raw);
}
