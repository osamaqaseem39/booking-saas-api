export const FACILITY_VERTICALS = [
  'arena',
  'gaming-zone',
  'snooker',
  'table-tennis',
] as const;

export type FacilityVertical = (typeof FACILITY_VERTICALS)[number];

export const ARENA_SUB_TYPES = [
  'cricket-indoor',
  'futsal-field',
  'padel-court',
] as const;

export const GAMING_ZONE_SUB_TYPES = [
  'pc',
  'ps5',
  'ps4',
  'xbox-360',
  'xbox-one',
  'xbox-series-x',
  'xbox-series-s',
  'vr',
  'driving-simulator',
] as const;

// These are not subtypes but separate main types
export const UPCOMING_TYPES = ['snooker', 'table-tennis'] as const;
