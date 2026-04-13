import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

/** Query params for GET /getVenues/all (optional filters; response is short map markers: venueId, name, address, lat/lng, logo, bannerImage). */
export class GetVenuesAllQueryDto {
  /**
   * Venue bucket: all | gaming | gaming-zone | futsal | FutsalArenas | cricket | padel (case-insensitive).
   * Omit or empty for every active venue.
   */
  @IsOptional()
  @IsString()
  category?: string;

  /**
   * Filter by city name(s), comma-separated (case-insensitive), e.g. `Lahore` or `Lahore,Karachi`.
   */
  @IsOptional()
  @IsString()
  city?: string;

  /** ISO date (YYYY-MM-DD). If set, startTime and endTime must also be set. */
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be HH:mm (24h)',
  })
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be HH:mm (24h)',
  })
  endTime?: string;
}
