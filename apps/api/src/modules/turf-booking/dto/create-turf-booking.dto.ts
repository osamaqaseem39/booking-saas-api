import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { TURF_SPORT_TYPES } from '../../arena/turf/turf.types';
import {
  TURF_BOOKING_STATUSES,
  TURF_PAYMENT_STATUSES,
} from '../entities/turf-booking.entity';

class SlotDto {
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime!: string;
}

export class CreateTurfBookingDto {
  @IsUUID('4')
  userId!: string;

  @IsUUID('4')
  turfId!: string;

  @IsDateString()
  bookingDate!: string;

  @IsIn(TURF_SPORT_TYPES)
  sportType!: (typeof TURF_SPORT_TYPES)[number];

  @IsObject()
  @ValidateNested()
  @Type(() => SlotDto)
  slot!: SlotDto;

  @Type(() => Number)
  @IsNumber()
  totalAmount!: number;

  @IsOptional()
  @IsIn(TURF_BOOKING_STATUSES)
  bookingStatus?: (typeof TURF_BOOKING_STATUSES)[number];

  @IsOptional()
  @IsIn(TURF_PAYMENT_STATUSES)
  paymentStatus?: (typeof TURF_PAYMENT_STATUSES)[number];
}
