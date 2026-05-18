import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  BOOKING_STATUSES,
  type BookingStatus,
} from '../types/booking.types';

export class ChangeBookingStatusDto {
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const v = value.toLowerCase();
    if (v === 'cancel') return 'cancelled';
    if (v === 'live') return 'live';
    return v;
  })
  @IsIn([...BOOKING_STATUSES])
  bookingStatus!: BookingStatus;

  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
