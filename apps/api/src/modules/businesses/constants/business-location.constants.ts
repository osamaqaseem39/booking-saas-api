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
  'turf',
  'padel',
  'table-tennis',
] as const;

export type BusinessLocationFacilityTypeCode =
  (typeof BUSINESS_LOCATION_FACILITY_TYPE_CODES)[number];

/** Gaming-zone station categories (dashboard setup + location tags). */
export const GAMING_LOCATION_FACILITY_TYPE_CODES = [
  'gaming-pc',
  'gaming-ps5',
  'gaming-ps4',
  'gaming-xbox-one',
  'gaming-xbox-360',
  'gaming-vr',
  'gaming-steering-sim',
] as const;

export type GamingLocationFacilityTypeCode =
  (typeof GAMING_LOCATION_FACILITY_TYPE_CODES)[number];

/** Accepted on create/update; normalized to canonical codes before persist. */
export const BUSINESS_LOCATION_FACILITY_LEGACY_TYPE_CODES = [
  'futsal',
  'cricket',
  'futsal-field',
  'cricket-indoor',
  'turf-court',
  'turf-court-futsal',
  'turf-court-cricket',
  'padel-court',
] as const;

export const ALL_ACCEPTED_BUSINESS_LOCATION_FACILITY_CODES = [
  ...BUSINESS_LOCATION_FACILITY_TYPE_CODES,
  ...BUSINESS_LOCATION_FACILITY_LEGACY_TYPE_CODES,
  ...GAMING_LOCATION_FACILITY_TYPE_CODES,
] as const;

/** Normalize location facility type tags to canonical `turf` / `padel`. */
export function normalizeLocationFacilityTypesForApi(
  raw: string[] | null | undefined,
): string[] {
  if (!raw?.length) return [];
  const out = new Set<string>();
  for (const t of raw) {
    const trimmed = (t ?? '').trim();
    if (!trimmed) continue;

    if (
      (GAMING_LOCATION_FACILITY_TYPE_CODES as readonly string[]).includes(trimmed)
    ) {
      out.add(trimmed);
    } else if (
      trimmed === 'turf' ||
      trimmed === 'futsal' ||
      trimmed === 'cricket' ||
      trimmed === 'futsal-field' ||
      trimmed === 'cricket-indoor' ||
      trimmed === 'turf-court' ||
      trimmed === 'turf-court-futsal' ||
      trimmed === 'turf-court-cricket'
    ) {
      out.add('turf');
    } else if (trimmed === 'padel-court' || trimmed === 'padel') {
      out.add('padel');
    } else if (
      trimmed === 'table-tennis' ||
      trimmed === 'table-tennis-table' ||
      trimmed === 'table-tennis-court'
    ) {
      out.add('table-tennis');
    } else {
      // Preserve unknown/new facility types for forward compatibility.
      out.add(trimmed);
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
