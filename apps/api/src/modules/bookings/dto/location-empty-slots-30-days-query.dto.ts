import { IsOptional, Matches } from 'class-validator';

export class LocationEmptySlots30DaysQueryDto {
  /**
   * Optional court type filter.
   * If omitted, all supported kinds are included.
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
}
