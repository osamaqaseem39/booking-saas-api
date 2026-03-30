import { BadRequestException } from '@nestjs/common';
import { LEGACY_TURF_FACILITY_TYPE_CODE } from '../businesses/business-location.constants';
import type { BusinessLocation } from '../businesses/entities/business-location.entity';

/** When a location lists facility types, new courts must match one of them. */
export function assertFacilityTypeAllowedForLocation(
  location: BusinessLocation,
  facilityTypeCode: string,
): void {
  const allowed = location.facilityTypes ?? [];
  if (allowed.length === 0) return;
  if (!allowed.includes(facilityTypeCode)) {
    throw new BadRequestException(
      `Location "${location.name}" is not configured for "${facilityTypeCode}". Add it under location facility types first.`,
    );
  }
}

/** Turf courts: allow legacy `turf-court` flag, or the sport-specific types for each mode. */
export function assertTurfSportModesAllowedForLocation(
  location: BusinessLocation,
  sportMode: 'futsal_only' | 'cricket_only' | 'both',
): void {
  const allowed = location.facilityTypes ?? [];
  if (allowed.length === 0) return;
  if (allowed.includes(LEGACY_TURF_FACILITY_TYPE_CODE)) return;

  const needFutsal = sportMode === 'futsal_only' || sportMode === 'both';
  const needCricket = sportMode === 'cricket_only' || sportMode === 'both';

  if (needFutsal && !allowed.includes('futsal-field')) {
    throw new BadRequestException(
      `Location "${location.name}" is not configured for Futsal. Enable it under location facility types first.`,
    );
  }
  if (needCricket && !allowed.includes('cricket-indoor')) {
    throw new BadRequestException(
      `Location "${location.name}" is not configured for Arena Cricket. Enable it under location facility types first.`,
    );
  }
}
