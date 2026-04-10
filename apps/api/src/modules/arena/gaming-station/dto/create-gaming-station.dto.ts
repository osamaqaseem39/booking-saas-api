import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDivisibleBy,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const SETUP_CODES = [
  'gaming-pc',
  'gaming-ps5',
  'gaming-ps4',
  'gaming-xbox-one',
  'gaming-xbox-360',
  'gaming-vr',
  'gaming-steering-sim',
] as const;
const UNIT_STATUS = ['active', 'maintenance', 'draft'] as const;

class GamingPeakPricingDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weekdayEvening?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weekend?: number;
}

class GamingAmenitiesDto {
  @IsOptional()
  @IsBoolean()
  snacksNearby?: boolean;

  @IsOptional()
  @IsBoolean()
  extraControllers?: boolean;

  @IsOptional()
  @IsBoolean()
  streamingCapture?: boolean;
}

export class CreateGamingStationDto {
  @IsUUID('4')
  businessLocationId!: string;

  @IsIn(SETUP_CODES)
  setupCode!: (typeof SETUP_CODES)[number];

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsIn(UNIT_STATUS)
  unitStatus?: (typeof UNIT_STATUS)[number];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pricePerSlot?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => GamingPeakPricingDto)
  peakPricing?: GamingPeakPricingDto;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  bundleNote?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @IsDivisibleBy(30)
  slotDurationMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bufferBetweenSlotsMinutes?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => GamingAmenitiesDto)
  amenities?: GamingAmenitiesDto;

  @IsOptional()
  @IsObject()
  specs?: Record<string, unknown>;
}
