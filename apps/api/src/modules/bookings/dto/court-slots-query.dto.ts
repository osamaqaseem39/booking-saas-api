import { IsDateString, IsOptional, Matches } from 'class-validator';

export class CourtSlotsQueryDto {
  @IsDateString()
  date!: string;

  /** Inclusive window start (HH:mm, hourly aligned). Default 00:00. */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be HH:mm (24h)',
  })
  startTime?: string;

  /** Exclusive window end (HH:mm or 24:00, hourly aligned). Default 24:00. */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, {
    message: 'endTime must be HH:mm or 24:00',
  })
  endTime?: string;
}
