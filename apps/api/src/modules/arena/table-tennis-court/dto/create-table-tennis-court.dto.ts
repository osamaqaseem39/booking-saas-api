import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const COURT_STATUS = ['active', 'maintenance', 'draft'] as const;

export class CreateTableTennisCourtDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsUUID('4')
  businessLocationId!: string;

  @IsOptional()
  @IsIn(COURT_STATUS)
  courtStatus?: (typeof COURT_STATUS)[number];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pricePerSlot?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([60])
  slotDurationMinutes?: 60;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  bufferBetweenSlotsMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID('4')
  timeSlotTemplateId?: string | null;
}
