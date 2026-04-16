import { IsDateString, IsOptional, Matches } from 'class-validator';

export class LocationFacilitySlotsQueryDto {
  @IsDateString()
  date!: string;

  /** Inclusive grid start (HH:mm, hourly aligned). Default 00:00. */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be HH:mm (24h)',
  })
  startTime?: string;

  /** Exclusive grid end (HH:mm or 24:00, hourly aligned). Default 24:00. */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, {
    message: 'endTime must be HH:mm or 24:00',
  })
  endTime?: string;

  /**
   * Limit to one facility kind. Accepts `padel` or `padel_court`.
   */
  @IsOptional()
  @Matches(/^(padel|padel_court|futsal|cricket|turf|turf_court)$/i, {
    message: 'courtType must be padel, futsal, cricket or turf',
  })
  courtType?: string;

  /** Cache-buster (timestamp) */
  @IsOptional()
  _t?: string;
}
