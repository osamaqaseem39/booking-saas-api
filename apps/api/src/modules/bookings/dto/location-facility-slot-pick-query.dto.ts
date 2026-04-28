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

  /**
   * Limit to one facility kind. Accepts `padel`, `futsal`, `cricket`, or `turf`.
   */
  @IsOptional()
  @Matches(
    /^(padel|padel_court|futsal|cricket|turf|turf_court|table-tennis|table_tennis|table_tennis_court|tabletennis)$/i,
    {
      message:
        'courtType must be padel, futsal, cricket, turf, or table-tennis',
    },
  )
  courtType?: string;

  /** Table tennis mode for price selection. */
  @IsOptional()
  @Matches(/^(singles|doubles)$/i, {
    message: 'tableTennisPlayType must be singles or doubles',
  })
  tableTennisPlayType?: string;

  /** Cache-buster (timestamp) */
  @IsOptional()
  _t?: string;
}
