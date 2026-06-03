import { IsDateString, IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { BOOKING_SPORT_TYPES, type BookingSportType } from '../types/booking.types';
import type { CourtKind } from '../types/booking.types';

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

  @IsOptional()
  @IsUUID()
  courtId?: string;

  @IsOptional()
  @IsIn(['padel_court', 'turf_court', 'table_tennis_court'])
  courtKind?: CourtKind;

  /** Cache-buster (timestamp) */
  @IsOptional()
  _t?: string;
}
