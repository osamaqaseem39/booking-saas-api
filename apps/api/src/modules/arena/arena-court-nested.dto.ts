import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Nested DTOs reused by CreateFutsalCourtDto / CreateCricketCourtDto. */
export class ArenaPeakPricingDto {
  @IsOptional()
  @IsNumber()
  weekdayEvening?: number;

  @IsOptional()
  @IsNumber()
  weekend?: number;
}

export class ArenaDiscountMembershipDto {
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

export class ArenaAmenitiesDto {
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

export class ArenaRulesDto {
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
