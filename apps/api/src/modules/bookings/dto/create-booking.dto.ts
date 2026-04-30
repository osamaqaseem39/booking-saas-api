import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import {
  BOOKING_STATUSES,
  BOOKING_SPORT_TYPES,
  type BookingSportType,
  type BookingStatus,
} from '../types/booking.types';
import { CreateBookingItemDto } from './create-booking-item.dto';
import { CreateBookingPaymentDto } from './create-booking-payment.dto';
import { CreateBookingPricingDto } from './create-booking-pricing.dto';

export class CreateBookingDto {
  @IsUUID('4')
  userId!: string;

  @IsIn([...BOOKING_SPORT_TYPES])
  sportType!: BookingSportType;

  @IsOptional()
  @IsDateString()
  bookingDate?: string;

  /**
   * One row per booked window. Multiple slots are supported: e.g. two consecutive
   * hours on the same court as two items, or different courts in one checkout.
   */
  @ValidateNested({ each: true })
  @Type(() => CreateBookingItemDto)
  @ArrayMinSize(1)
  items!: CreateBookingItemDto[];

  @ValidateNested()
  @Type(() => CreateBookingPricingDto)
  pricing!: CreateBookingPricingDto;

  @ValidateNested()
  @Type(() => CreateBookingPaymentDto)
  payment!: CreateBookingPaymentDto;

  @IsOptional()
  @IsIn([...BOOKING_STATUSES])
  bookingStatus?: BookingStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  allowImmediate?: boolean;
}
