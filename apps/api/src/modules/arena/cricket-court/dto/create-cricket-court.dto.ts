import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDivisibleBy,
  IsIn,
  IsInt,
  Min,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  ArenaAmenitiesDto,
  ArenaDiscountMembershipDto,
  ArenaPeakPricingDto,
  ArenaRulesDto,
} from '../../arena-court-nested.dto';

const COURT_STATUS = ['active', 'maintenance', 'draft'] as const;
const TWIN_KIND = ['futsal_court', 'cricket_court'] as const;
const CEILING_UNIT = ['ft', 'm'] as const;
const COVERED = ['open', 'semi_covered', 'fully_indoor'] as const;
const BOUNDARY = ['net', 'wall'] as const;
const LIGHTING = ['led_floodlights', 'mixed', 'daylight'] as const;
const SURFACE = ['artificial_turf', 'hard_surface'] as const;
const CRICKET_FMT = ['tape_ball', 'tennis_ball', 'hard_ball'] as const;
const PRACTICE = ['full_ground', 'nets_mode'] as const;
const VENT = ['natural', 'fans', 'ac'] as const;

export class CreateCricketCourtDto {
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

  @IsOptional()
  @IsIn(CRICKET_FMT)
  cricketFormat?: (typeof CRICKET_FMT)[number];

  @IsOptional()
  @IsBoolean()
  cricketStumpsAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  cricketBowlingMachine?: boolean;

  @IsOptional()
  @IsIn(PRACTICE)
  cricketPracticeMode?: (typeof PRACTICE)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pricePerSlot?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ArenaPeakPricingDto)
  peakPricing?: ArenaPeakPricingDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ArenaDiscountMembershipDto)
  discountMembership?: ArenaDiscountMembershipDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @IsDivisibleBy(30)
  slotDurationMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bufferBetweenSlotsMinutes?: number;

  @IsOptional()
  @IsBoolean()
  allowParallelBooking?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ArenaAmenitiesDto)
  amenities?: ArenaAmenitiesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ArenaRulesDto)
  rules?: ArenaRulesDto;

  @IsOptional()
  @IsIn(TWIN_KIND)
  linkedTwinCourtKind?: (typeof TWIN_KIND)[number];

  @IsOptional()
  @IsUUID('4')
  linkedTwinCourtId?: string;
}
