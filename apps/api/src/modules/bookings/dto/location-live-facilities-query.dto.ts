import { IsDateString, IsOptional, Matches } from 'class-validator';

/** Query for `GET .../facilities/live` (same time grid and filters as `available-slots`). */
export class LocationLiveFacilitiesQueryDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be HH:mm (24h)',
  })
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, {
    message: 'endTime must be HH:mm or 24:00',
  })
  endTime?: string;

  @IsOptional()
  @Matches(
    /^(padel|padel_court|futsal|cricket|turf|turf_court|table-tennis|table_tennis|table_tennis_court|tabletennis)$/i,
    {
      message:
        'courtType must be padel, futsal, cricket, turf, or table-tennis',
    },
  )
  courtType?: string;

  @IsOptional()
  _t?: string;
}
