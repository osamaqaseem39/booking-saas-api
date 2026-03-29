import { BadRequestException } from '@nestjs/common';
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
