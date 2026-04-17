export const TURF_STATUS = ['active', 'maintenance'] as const;
export type TurfStatus = (typeof TURF_STATUS)[number];

export const TURF_COVERED_TYPES = ['open', 'semi_covered', 'indoor'] as const;
export type TurfCoveredType = (typeof TURF_COVERED_TYPES)[number];

export const TURF_SPORT_TYPES = ['futsal', 'cricket'] as const;
export type TurfSportType = (typeof TURF_SPORT_TYPES)[number];

export type TurfSportConfig = {
  futsal?: {
    format?: string;
    goalPostAvailable?: boolean;
    goalPostSize?: string;
    lineMarkings?: string;
  };
  cricket?: {
    type?: string;
    stumpsAvailable?: boolean;
    bowlingMachine?: boolean;
  };
  common?: {
    imageUrls?: string[];
    arenaLabel?: string;
    ceilingHeightUnit?: string;
    sideNetting?: boolean;
    netHeight?: string;
    boundaryType?: string;
    ventilation?: string[];
    lighting?: string;
    shockAbsorptionLayer?: boolean;
    discountMembership?: any;
    amenities?: any;
    rules?: any;
    allowParallelBooking?: boolean;
  };
};

export type TurfPricingConfig = {
  futsal?: {
    basePrice?: number;
    peakPrice?: number;
    weekendPrice?: number;
  };
  cricket?: {
    basePrice?: number;
    peakPrice?: number;
    weekendPrice?: number;
  };
};
