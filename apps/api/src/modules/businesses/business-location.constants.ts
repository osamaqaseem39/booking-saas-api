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
