/** JSONB shapes stored on turf_courts */
export type TurfVentilation = 'natural' | 'fans' | 'ac';

export interface TurfPeakPricing {
  weekdayEvening?: number;
  weekend?: number;
}

export interface TurfDiscountMembership {
  label?: string;
  amount?: number;
  percentOff?: number;
}

export interface TurfAmenities {
  changingRoom?: boolean;
  washroom?: boolean;
  parking?: boolean;
  drinkingWater?: boolean;
  seatingArea?: boolean;
}

export interface TurfRules {
  maxPlayers?: number;
  safetyInstructions?: string;
  cancellationPolicy?: string;
}
