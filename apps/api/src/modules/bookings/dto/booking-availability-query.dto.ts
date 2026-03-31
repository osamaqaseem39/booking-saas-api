import { IsDateString, IsIn, IsOptional, Matches } from 'class-validator';
import { BOOKING_SPORT_TYPES, type BookingSportType } from '../booking.types';

export class BookingAvailabilityQueryDto {
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

  @IsOptional()
  @IsIn([...BOOKING_SPORT_TYPES])
  sportType?: BookingSportType;
}
