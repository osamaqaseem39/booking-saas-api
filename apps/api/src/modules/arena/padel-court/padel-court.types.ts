export interface PadelPeakPricing {
  weekdayEvening?: number;
  weekend?: number;
}

export interface PadelExtras {
  racketRental?: boolean;
  ballRental?: boolean;
  coachingAvailable?: boolean;
}

export interface PadelAmenities {
  seating?: boolean;
  changingRoom?: boolean;
  parking?: boolean;
}

export interface PadelRules {
  maxPlayers?: number;
  gameRules?: string;
  cancellationPolicy?: string;
}
