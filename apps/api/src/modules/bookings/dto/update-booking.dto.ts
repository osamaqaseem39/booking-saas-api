import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import {
  BOOKING_ITEM_STATUSES,
  BOOKING_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type BookingItemStatus,
  type BookingStatus,
  type PaymentMethod,
  type PaymentStatus,
} from '../types/booking.types';

export class UpdateBookingPaymentDto {
  @IsOptional()
  @IsIn([...PAYMENT_STATUSES])
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsIn([...PAYMENT_METHODS])
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}

export class UpdateBookingItemStatusDto {
  @IsUUID('4')
  itemId!: string;

  @IsIn([...BOOKING_ITEM_STATUSES])
  status!: BookingItemStatus;
}

export class UpdateBookingDto {
  @IsOptional()
  @IsIn([...BOOKING_STATUSES])
  bookingStatus?: BookingStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBookingPaymentDto)
  payment?: UpdateBookingPaymentDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateBookingItemStatusDto)
  itemStatuses?: UpdateBookingItemStatusDto[];
}
