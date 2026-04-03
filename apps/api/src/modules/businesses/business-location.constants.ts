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
 * Product: Turf (combined futsal + cricket via `/arena/turf-courts`) and Padel.
 */
export const BUSINESS_LOCATION_FACILITY_TYPE_CODES = [
  'turf-court',
  'padel-court',
] as const;

export type BusinessLocationFacilityTypeCode =
  (typeof BUSINESS_LOCATION_FACILITY_TYPE_CODES)[number];

/** Alias for turf in DB / clients; same canonical code as `turf-court`. */
export const LEGACY_TURF_FACILITY_TYPE_CODE = 'turf-court' as const;

const FACILITY_CODES_SET = new Set<string>(BUSINESS_LOCATION_FACILITY_TYPE_CODES);

/** Sport-specific types stored on older rows map to canonical `turf-court`. */
const TURF_FACILITY_ALIASES = new Set([
  LEGACY_TURF_FACILITY_TYPE_CODE,
  'futsal-field',
  'cricket-indoor',
]);

/** Normalize for API clients: legacy sport rows → `turf-court`; drop unknown codes. */
export function normalizeLocationFacilityTypesForApi(
  raw: string[] | null | undefined,
): string[] {
  if (!raw?.length) return [];
  const out = new Set<string>();
  for (const t of raw) {
    if (TURF_FACILITY_ALIASES.has(t)) {
      out.add('turf-court');
    } else if (FACILITY_CODES_SET.has(t)) {
      out.add(t);
    }
  }
  return [...out].sort();
}
