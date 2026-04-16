/** Shared JSONB shape definitions for arena facilities. */
export type ArenaVentilation = 'natural' | 'fans' | 'ac';

export interface ArenaPeakPricing {
  weekdayEvening?: number;
  weekend?: number;
}

export interface ArenaDiscountMembership {
  label?: string;
  amount?: number;
  percentOff?: number;
}

export interface ArenaAmenities {
  changingRoom?: boolean;
  washroom?: boolean;
  parking?: boolean;
  drinkingWater?: boolean;
  seatingArea?: boolean;
}

export interface ArenaRules {
  maxPlayers?: number;
  safetyInstructions?: string;
  cancellationPolicy?: string;
}
