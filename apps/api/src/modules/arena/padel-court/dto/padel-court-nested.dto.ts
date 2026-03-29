import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PadelPeakPricingDto {
  @IsOptional()
  @IsNumber()
  weekdayEvening?: number;

  @IsOptional()
  @IsNumber()
  weekend?: number;
}

export class PadelExtrasDto {
  @IsOptional()
  @IsBoolean()
  racketRental?: boolean;

  @IsOptional()
  @IsBoolean()
  ballRental?: boolean;

  @IsOptional()
  @IsBoolean()
  coachingAvailable?: boolean;
}

export class PadelAmenitiesDto {
  @IsOptional()
  @IsBoolean()
  seating?: boolean;

  @IsOptional()
  @IsBoolean()
  changingRoom?: boolean;

  @IsOptional()
  @IsBoolean()
  parking?: boolean;
}

export class PadelRulesDto {
  @IsOptional()
  @IsNumber()
  maxPlayers?: number;

  @IsOptional()
  @IsString()
  gameRules?: string;

  @IsOptional()
  @IsString()
  cancellationPolicy?: string;
}
