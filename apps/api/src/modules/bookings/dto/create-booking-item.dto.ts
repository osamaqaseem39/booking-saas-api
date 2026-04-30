import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import {
  BOOKING_ITEM_STATUSES,
  COURT_KINDS,
  type BookingItemStatus,
  type CourtKind,
} from '../types/booking.types';

export class CreateBookingItemDto {
  @IsOptional()
  @Transform(({ value, obj }) => value ?? obj?.bookingDate)
  @IsDateString()
  date?: string;

  @IsOptional()
  @Transform(({ value, obj }) => value ?? obj?.date)
  @IsDateString()
  bookingDate?: string;

  @Transform(({ value }) => {
    if (value === 'futsal_court' || value === 'cricket_court')
      return 'turf_court';
    return value;
  })
  @IsIn([...COURT_KINDS])
  courtKind!: CourtKind;

  @Transform(({ value, obj }) => {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof obj?.facilityId === 'string' && obj.facilityId.trim()) {
      return obj.facilityId.trim();
    }
    if (
      typeof obj?.selectedFacilityId === 'string' &&
      obj.selectedFacilityId.trim()
    ) {
      return obj.selectedFacilityId.trim();
    }
    if (typeof obj?.fieldId === 'string' && obj.fieldId.trim()) {
      return obj.fieldId.trim();
    }
    return value;
  })
  @IsUUID('4')
  courtId!: string;

  @IsOptional()
  @IsString()
  slotId?: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be HH:mm (24h)',
  })
  startTime!: string;

  @Matches(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, {
    message: 'endTime must be HH:mm (24h) or 24:00',
  })
  endTime!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsIn([...BOOKING_ITEM_STATUSES])
  status?: BookingItemStatus;
}
