export const TURF_SPORT_MODES = [
  'futsal_only',
  'cricket_only',
  'both',
] as const;
export type TurfSportMode = (typeof TURF_SPORT_MODES)[number];

export function turfSportModeToFlags(mode: TurfSportMode): {
  supportsFutsal: boolean;
  supportsCricket: boolean;
} {
  switch (mode) {
    case 'futsal_only':
      return { supportsFutsal: true, supportsCricket: false };
    case 'cricket_only':
      return { supportsFutsal: false, supportsCricket: true };
    case 'both':
      return { supportsFutsal: true, supportsCricket: true };
  }
}

export function turfFlagsToSportMode(
  supportsFutsal: boolean,
  supportsCricket: boolean,
): TurfSportMode {
  if (supportsFutsal && supportsCricket) return 'both';
  if (supportsFutsal) return 'futsal_only';
  if (supportsCricket) return 'cricket_only';
  return 'both';
}

export type TurfSportFilter = 'futsal' | 'cricket';
