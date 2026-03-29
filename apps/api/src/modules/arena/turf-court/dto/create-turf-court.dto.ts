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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  TurfAmenitiesDto,
  TurfDiscountMembershipDto,
  TurfPeakPricingDto,
  TurfRulesDto,
} from './turf-court-nested.dto';

const COURT_STATUS = ['active', 'maintenance'] as const;
const CEILING_UNIT = ['ft', 'm'] as const;
const COVERED = ['open', 'semi_covered', 'fully_indoor'] as const;
const BOUNDARY = ['net', 'wall'] as const;
const LIGHTING = ['led_floodlights', 'mixed', 'daylight'] as const;
const SURFACE = ['artificial_turf', 'hard_surface'] as const;
const FUTSAL_FMT = ['5v5', '6v6', '7v7'] as const;
const LINE_MARK = ['permanent', 'temporary'] as const;
const CRICKET_FMT = ['tape_ball', 'tennis_ball', 'hard_ball'] as const;
const PRACTICE = ['full_ground', 'nets_mode'] as const;
const VENT = ['natural', 'fans', 'ac'] as const;
const SPORT_MODE = ['futsal_only', 'cricket_only', 'both'] as const;

export class CreateTurfCourtDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsUUID('4')
  businessLocationId!: string;

  @IsIn(SPORT_MODE)
  sportMode!: (typeof SPORT_MODE)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  arenaLabel?: string;

  @IsOptional()
  @IsIn(COURT_STATUS)
  courtStatus?: (typeof COURT_STATUS)[number];

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
  sideNetting?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  netHeight?: string;

  @IsOptional()
  @IsIn(BOUNDARY)
  boundaryType?: (typeof BOUNDARY)[number];

  @IsOptional()
  @IsArray()
  @IsIn(VENT, { each: true })
  ventilation?: (typeof VENT)[number][];

  @IsOptional()
  @IsIn(LIGHTING)
  lighting?: (typeof LIGHTING)[number];

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
  @IsString()
  @MaxLength(120)
  turfQuality?: string;

  @IsOptional()
  @IsBoolean()
  shockAbsorptionLayer?: boolean;

  @ValidateIf(
    (o: CreateTurfCourtDto) =>
      o.sportMode === 'futsal_only' || o.sportMode === 'both',
  )
  @IsOptional()
  @IsIn(FUTSAL_FMT)
  futsalFormat?: (typeof FUTSAL_FMT)[number];

  @ValidateIf(
    (o: CreateTurfCourtDto) =>
      o.sportMode === 'futsal_only' || o.sportMode === 'both',
  )
  @IsOptional()
  @IsBoolean()
  futsalGoalPostsAvailable?: boolean;

  @ValidateIf(
    (o: CreateTurfCourtDto) =>
      o.sportMode === 'futsal_only' || o.sportMode === 'both',
  )
  @IsOptional()
  @IsString()
  @MaxLength(80)
  futsalGoalPostSize?: string;

  @ValidateIf(
    (o: CreateTurfCourtDto) =>
      o.sportMode === 'futsal_only' || o.sportMode === 'both',
  )
  @IsOptional()
  @IsIn(LINE_MARK)
  futsalLineMarkings?: (typeof LINE_MARK)[number];

  @ValidateIf(
    (o: CreateTurfCourtDto) =>
      o.sportMode === 'cricket_only' || o.sportMode === 'both',
  )
  @IsOptional()
  @IsIn(CRICKET_FMT)
  cricketFormat?: (typeof CRICKET_FMT)[number];

  @ValidateIf(
    (o: CreateTurfCourtDto) =>
      o.sportMode === 'cricket_only' || o.sportMode === 'both',
  )
  @IsOptional()
  @IsBoolean()
  cricketStumpsAvailable?: boolean;

  @ValidateIf(
    (o: CreateTurfCourtDto) =>
      o.sportMode === 'cricket_only' || o.sportMode === 'both',
  )
  @IsOptional()
  @IsBoolean()
  cricketBowlingMachine?: boolean;

  @ValidateIf(
    (o: CreateTurfCourtDto) =>
      o.sportMode === 'cricket_only' || o.sportMode === 'both',
  )
  @IsOptional()
  @IsIn(PRACTICE)
  cricketPracticeMode?: (typeof PRACTICE)[number];

  @ValidateIf(
    (o: CreateTurfCourtDto) =>
      o.sportMode === 'futsal_only' || o.sportMode === 'both',
  )
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  futsalPricePerSlot?: number;

  @ValidateIf(
    (o: CreateTurfCourtDto) =>
      o.sportMode === 'cricket_only' || o.sportMode === 'both',
  )
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cricketPricePerSlot?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TurfPeakPricingDto)
  peakPricing?: TurfPeakPricingDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TurfDiscountMembershipDto)
  discountMembership?: TurfDiscountMembershipDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsIn([30, 60])
  slotDurationMinutes?: 30 | 60;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bufferBetweenSlotsMinutes?: number;

  @IsOptional()
  @IsBoolean()
  allowParallelBooking?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => TurfAmenitiesDto)
  amenities?: TurfAmenitiesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TurfRulesDto)
  rules?: TurfRulesDto;
}
