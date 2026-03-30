/** Supported location kinds for dashboard setup. */
export const BUSINESS_LOCATION_TYPE_CODES = [
  'arena',
  'gaming-zone',
  'snooker',
  'table-tennis',
] as const;

export type BusinessLocationTypeCode =
  (typeof BUSINESS_LOCATION_TYPE_CODES)[number];

/**
 * Sub-facility / court kinds this location can host (arena vertical).
 * Product: Arena Cricket, Futsal, Padel only — align with `ARENA_SUB_TYPE_CODES`.
 */
export const BUSINESS_LOCATION_FACILITY_TYPE_CODES = [
  'cricket-indoor',
  'futsal-field',
  'padel-court',
] as const;

export type BusinessLocationFacilityTypeCode =
  (typeof BUSINESS_LOCATION_FACILITY_TYPE_CODES)[number];

/** Stored on older rows; expanded in API responses to futsal + cricket. */
export const LEGACY_TURF_FACILITY_TYPE_CODE = 'turf-court' as const;

const FACILITY_CODES_SET = new Set<string>(BUSINESS_LOCATION_FACILITY_TYPE_CODES);

/** Normalize for API clients: legacy turf → both sports; drop unknown codes. */
export function normalizeLocationFacilityTypesForApi(
  raw: string[] | null | undefined,
): string[] {
  if (!raw?.length) return [];
  const out = new Set<string>();
  for (const t of raw) {
    if (t === LEGACY_TURF_FACILITY_TYPE_CODE) {
      out.add('futsal-field');
      out.add('cricket-indoor');
    } else if (FACILITY_CODES_SET.has(t)) {
      out.add(t);
    }
  }
  return [...out].sort();
}
