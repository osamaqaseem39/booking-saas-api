import { Matches, IsUUID, IsString, IsDateString } from 'class-validator';

export class PlaceFutsalBookingDto {
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

  /** e.g. `futsal_field` or `turf_court` (hyphen or underscore allowed). */
  @IsString()
  facilitySelected!: string;

  @IsUUID('4')
  fieldSelected!: string;

  @IsUUID('4')
  venueId!: string;

  @IsUUID('4')
  userId!: string;
}
