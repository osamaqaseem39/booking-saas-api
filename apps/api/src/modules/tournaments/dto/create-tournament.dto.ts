import {
  IsArray,
  IsDateString,
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
import { Type } from 'class-transformer';
import { TOURNAMENT_STRUCTURE_TYPES } from '../types/tournament.types';

export class CreateTournamentDto {
  @IsString()
  @MaxLength(300)
  name!: string;

  @IsString()
  @MaxLength(64)
  sport!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  venueIds!: string[];

  @IsOptional()
  @IsDateString()
  registrationOpensAt?: string;

  @IsOptional()
  @IsDateString()
  registrationClosesAt?: string;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsInt()
  @Min(1)
  maxTeams!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  entryFeeAmount?: number;

  @IsOptional()
  @IsString()
  entryFeeCurrency?: string;

  @IsOptional()
  @IsObject()
  prizePool?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  rules?: string;

  @IsIn([...TOURNAMENT_STRUCTURE_TYPES])
  structureType!: (typeof TOURNAMENT_STRUCTURE_TYPES)[number];

  @IsOptional()
  @IsObject()
  advancement?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  groupCount?: number;
}

export class PreviewStructureDto {
  @IsInt()
  @Min(1)
  teamCount!: number;

  @IsIn([...TOURNAMENT_STRUCTURE_TYPES])
  structureType!: (typeof TOURNAMENT_STRUCTURE_TYPES)[number];

  @IsOptional()
  @IsObject()
  advancement?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  groupCount?: number;
}

export class UpdateTournamentDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string;

  @IsOptional()
  @IsString()
  sport?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  venueIds?: string[];

  @IsOptional()
  @IsDateString()
  registrationOpensAt?: string;

  @IsOptional()
  @IsDateString()
  registrationClosesAt?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxTeams?: number;

  @IsOptional()
  @IsNumber()
  entryFeeAmount?: number;

  @IsOptional()
  @IsString()
  rules?: string;

  @IsOptional()
  @IsObject()
  prizePool?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;
}
