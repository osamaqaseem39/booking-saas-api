import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MATCH_STATUSES } from '../types/tournament.types';

export class PadelSetScoreDto {
  @IsInt()
  @Min(0)
  home!: number;

  @IsInt()
  @Min(0)
  away!: number;
}

export class ScheduleMatchDto {
  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsUUID('4')
  venueId?: string;

  @IsOptional()
  @IsString()
  courtKind?: string;

  @IsOptional()
  @IsUUID('4')
  courtId?: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  durationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}

export class SubmitScoreDto {
  @IsInt()
  @Min(0)
  homeScore!: number;

  @IsInt()
  @Min(0)
  awayScore!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PadelSetScoreDto)
  sets?: PadelSetScoreDto[];
}

export class WalkoverMatchDto {
  @IsUUID('4')
  winnerTeamId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateMatchStatusDto {
  @IsIn([...MATCH_STATUSES])
  status!: (typeof MATCH_STATUSES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
