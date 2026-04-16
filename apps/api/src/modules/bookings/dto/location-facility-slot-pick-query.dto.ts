import { IsDateString, IsOptional, Matches } from 'class-validator';

/** Query for facilities at a location that are free for one calendar grid slot. */
export class LocationFacilitySlotPickQueryDto {
  @IsDateString()
  date!: string;

  /** Slot start (HH:mm, on the hourly grid). */
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be HH:mm (24h)',
  })
  startTime!: string;

  /**
   * Slot end (HH:mm or 24:00), exclusive, on the hourly grid.
   * Omit to use one hourly grid step after `startTime`.
   */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, {
    message: 'endTime must be HH:mm or 24:00',
  })
  endTime?: string;

  /** Cache-buster (timestamp) */
  @IsOptional()
  _t?: string;
}
