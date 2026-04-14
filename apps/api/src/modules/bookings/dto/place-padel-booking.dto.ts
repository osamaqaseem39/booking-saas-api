import { Transform } from 'class-transformer';
import { Matches, IsUUID, IsString, IsDateString } from 'class-validator';

export class PlacePadelBookingDto {
  @IsDateString()
  date!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be HH:mm (24h)',
  })
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be HH:mm (24h)',
  })
  endTime!: string;

  /** e.g. `padel_court` (legacy `padel` accepted server-side). */
  @Transform(({ value, obj }) => {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof obj?.facilityType === 'string' && obj.facilityType.trim()) {
      return obj.facilityType.trim();
    }
    if (typeof obj?.courtKind === 'string' && obj.courtKind.trim()) {
      return obj.courtKind.trim();
    }
    return 'padel_court';
  })
  @IsString()
  facilitySelected!: string;

  @Transform(({ value, obj }) => {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof obj?.fieldId === 'string' && obj.fieldId.trim()) {
      return obj.fieldId.trim();
    }
    if (typeof obj?.facilityId === 'string' && obj.facilityId.trim()) {
      return obj.facilityId.trim();
    }
    if (
      typeof obj?.selectedFacilityId === 'string' &&
      obj.selectedFacilityId.trim()
    ) {
      return obj.selectedFacilityId.trim();
    }
    return value;
  })
  @IsUUID('4')
  fieldSelected!: string;

  @IsUUID('4')
  venueId!: string;

  @IsUUID('4')
  userId!: string;
}
