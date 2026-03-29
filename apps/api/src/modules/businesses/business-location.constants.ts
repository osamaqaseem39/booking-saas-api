/**
 * Suggested location kinds for venues/branches. API accepts any string ≤80 chars;
 * these are documented defaults for UIs.
 */
export const BUSINESS_LOCATION_TYPE_CODES = [
  'arena',
  'branch',
  'headquarters',
  'indoor_court',
  'outdoor_pitch',
  'retail',
  'warehouse',
  'other',
] as const;

export type BusinessLocationTypeCode = (typeof BUSINESS_LOCATION_TYPE_CODES)[number];

/**
 * Sub-facility / court kinds this location can host (arena vertical).
 * Align with `arena-meta` resource keys and `ARENA_SUB_TYPE_CODES` + turf.
 */
export const BUSINESS_LOCATION_FACILITY_TYPE_CODES = [
  'turf-court',
  'cricket-indoor',
  'futsal-field',
  'padel-court',
] as const;

export type BusinessLocationFacilityTypeCode =
  (typeof BUSINESS_LOCATION_FACILITY_TYPE_CODES)[number];
