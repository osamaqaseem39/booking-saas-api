import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class TurfPeakPricingDto {
  @IsOptional()
  @IsNumber()
  weekdayEvening?: number;

  @IsOptional()
  @IsNumber()
  weekend?: number;
}

export class TurfDiscountMembershipDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsNumber()
  percentOff?: number;
}

export class TurfAmenitiesDto {
  @IsOptional()
  @IsBoolean()
  changingRoom?: boolean;

  @IsOptional()
  @IsBoolean()
  washroom?: boolean;

  @IsOptional()
  @IsBoolean()
  parking?: boolean;

  @IsOptional()
  @IsBoolean()
  drinkingWater?: boolean;

  @IsOptional()
  @IsBoolean()
  seatingArea?: boolean;
}

export class TurfRulesDto {
  @IsOptional()
  @IsNumber()
  maxPlayers?: number;

  @IsOptional()
  @IsString()
  safetyInstructions?: string;

  @IsOptional()
  @IsString()
  cancellationPolicy?: string;
}
