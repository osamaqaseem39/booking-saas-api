import { CricketCourt } from './cricket-court/entities/cricket-court.entity';
import { FutsalCourt } from './futsal-court/entities/futsal-court.entity';

/** Single-row dual turf: cricket APIs read the same UUID from `futsal_courts`. */
export function isDualSportFutsalTurf(row: FutsalCourt): boolean {
  return row.supportsCricket === true;
}

export function futsalDualTurfAsCricketCourt(f: FutsalCourt): CricketCourt {
  const c = new CricketCourt();
  Object.assign(c, {
    id: f.id,
    tenantId: f.tenantId,
    businessLocationId: f.businessLocationId,
    name: f.name,
    arenaLabel: f.arenaLabel,
    courtStatus: f.courtStatus,
    imageUrls: f.imageUrls,
    ceilingHeightValue: f.ceilingHeightValue,
    ceilingHeightUnit: f.ceilingHeightUnit,
    coveredType: f.coveredType,
    sideNetting: f.sideNetting,
    netHeight: f.netHeight,
    boundaryType: f.boundaryType,
    ventilation: f.ventilation,
    lighting: f.lighting,
    lengthM: f.lengthM,
    widthM: f.widthM,
    surfaceType: f.surfaceType,
    turfQuality: f.turfQuality,
    shockAbsorptionLayer: f.shockAbsorptionLayer,
    cricketFormat: f.cricketFormat,
    cricketStumpsAvailable: f.cricketStumpsAvailable,
    cricketBowlingMachine: f.cricketBowlingMachine,
    cricketPracticeMode: f.cricketPracticeMode,
    pricePerSlot: f.pricePerSlot,
    peakPricing: f.peakPricing,
    discountMembership: f.discountMembership,
    slotDurationMinutes: f.slotDurationMinutes,
    bufferBetweenSlotsMinutes: f.bufferBetweenSlotsMinutes,
    allowParallelBooking: f.allowParallelBooking,
    timeSlotTemplateId: f.timeSlotTemplateId,
    amenities: f.amenities,
    rules: f.rules,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  });
  return c;
}
