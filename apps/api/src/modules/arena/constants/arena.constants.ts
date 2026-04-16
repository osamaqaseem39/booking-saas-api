/** Main facility vertical code for this product slice */
export const ARENA_VERTICAL_CODE = 'arena' as const;

export const ARENA_SUB_TYPE_CODES = [
  'padel-court',
  'turf',
] as const;

export type ArenaSubTypeCode = (typeof ARENA_SUB_TYPE_CODES)[number];
