import { Transform, Type } from 'class-transformer';
import {
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
} from '../booking.types';

export class CreateBookingItemDto {
  @IsIn([...COURT_KINDS])
  courtKind!: CourtKind;

  @Transform(({ value, obj }) => {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof obj?.facilityId === 'string' && obj.facilityId.trim()) {
      return obj.facilityId.trim();
    }
    if (typeof obj?.selectedFacilityId === 'string' && obj.selectedFacilityId.trim()) {
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

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be HH:mm (24h)',
  })
  endTime!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsIn([...BOOKING_ITEM_STATUSES])
  status!: BookingItemStatus;
}
