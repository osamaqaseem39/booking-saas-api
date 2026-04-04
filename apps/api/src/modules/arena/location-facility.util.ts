import { BadRequestException } from '@nestjs/common';
import type { BusinessLocation } from '../businesses/entities/business-location.entity';

const FUTSAL_FACILITY_CODES = new Set([
  'futsal',
  'futsal-field',
  'turf-court-futsal',
  'turf-court',
]);

const CRICKET_FACILITY_CODES = new Set([
  'cricket',
  'cricket-indoor',
  'turf-court-cricket',
  'turf-court',
]);

const PADEL_FACILITY_CODES = new Set(['padel', 'padel-court']);

function locationAllowsFutsalFacility(allowed: string[]): boolean {
  return allowed.some((c) => FUTSAL_FACILITY_CODES.has(c));
}

function locationAllowsCricketFacility(allowed: string[]): boolean {
  return allowed.some((c) => CRICKET_FACILITY_CODES.has(c));
}

function locationAllowsPadelFacility(allowed: string[]): boolean {
  return allowed.some((c) => PADEL_FACILITY_CODES.has(c));
}

/** When a location lists facility types, new courts must match one of them. */
export function assertFacilityTypeAllowedForLocation(
  location: BusinessLocation,
  facilityTypeCode: string,
): void {
  const allowed = location.facilityTypes ?? [];
  if (allowed.length === 0) return;

  if (facilityTypeCode === 'futsal') {
    if (!locationAllowsFutsalFacility(allowed)) {
      throw new BadRequestException(
        `Location "${location.name}" is not configured for futsal. Add it under location facility types first.`,
      );
    }
    return;
  }
  if (facilityTypeCode === 'cricket') {
    if (!locationAllowsCricketFacility(allowed)) {
      throw new BadRequestException(
        `Location "${location.name}" is not configured for cricket. Add it under location facility types first.`,
      );
    }
    return;
  }
  if (facilityTypeCode === 'padel' || facilityTypeCode === 'padel-court') {
    if (!locationAllowsPadelFacility(allowed)) {
      throw new BadRequestException(
        `Location "${location.name}" is not configured for padel. Add it under location facility types first.`,
      );
    }
    return;
  }
  if (!allowed.includes(facilityTypeCode)) {
    throw new BadRequestException(
      `Location "${location.name}" is not configured for "${facilityTypeCode}". Add it under location facility types first.`,
    );
  }
}
