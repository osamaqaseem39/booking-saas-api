import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  PadelAmenitiesDto,
  PadelExtrasDto,
  PadelPeakPricingDto,
  PadelRulesDto,
} from './padel-court-nested.dto';

const COURT_STATUS = ['active', 'maintenance', 'draft'] as const;
const CEILING_UNIT = ['ft', 'm'] as const;
const COVERED = ['indoor', 'semi_covered'] as const;
const WALL = ['full_glass', 'glass_mesh'] as const;
const SURFACE = ['synthetic_turf', 'acrylic'] as const;
const MATCH = ['singles', 'doubles'] as const;

export class CreatePadelCourtDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsUUID('4')
  businessLocationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  arenaLabel?: string;

  @IsOptional()
  @IsIn(COURT_STATUS)
  courtStatus?: (typeof COURT_STATUS)[number];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ceilingHeightValue?: number;

  @IsOptional()
  @IsIn(CEILING_UNIT)
  ceilingHeightUnit?: (typeof CEILING_UNIT)[number];

  @IsOptional()
  @IsIn(COVERED)
  coveredType?: (typeof COVERED)[number];

  @IsOptional()
  @IsBoolean()
  glassWalls?: boolean;

  @IsOptional()
  @IsIn(WALL)
  wallType?: (typeof WALL)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lighting?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ventilation?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lengthM?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  widthM?: number;

  @IsOptional()
  @IsIn(SURFACE)
  surfaceType?: (typeof SURFACE)[number];

  @IsOptional()
  @IsIn(MATCH)
  matchType?: (typeof MATCH)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPlayers?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pricePerSlot?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PadelPeakPricingDto)
  peakPricing?: PadelPeakPricingDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  membershipPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsIn([60, 90])
  slotDurationMinutes?: 60 | 90;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bufferBetweenSlotsMinutes?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PadelExtrasDto)
  extras?: PadelExtrasDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PadelAmenitiesDto)
  amenities?: PadelAmenitiesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PadelRulesDto)
  rules?: PadelRulesDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
