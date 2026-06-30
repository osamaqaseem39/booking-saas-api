import {
  IsArray,
  IsBoolean,
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

  @IsOptional()
  @IsBoolean()
  superTiebreak?: boolean;
}

export class CricketInningsScoreDto {
  @IsInt()
  @Min(0)
  runs!: number;

  @IsInt()
  @Min(0)
  wickets!: number;

  @IsInt()
  @Min(0)
  balls!: number;
}

export class TableTennisGameScoreDto {
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TableTennisGameScoreDto)
  games?: TableTennisGameScoreDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CricketInningsScoreDto)
  homeInnings?: CricketInningsScoreDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CricketInningsScoreDto)
  awayInnings?: CricketInningsScoreDto;

  @IsOptional()
  @IsIn(['home', 'away'])
  firstBatting?: 'home' | 'away';

  @IsOptional()
  @ValidateNested()
  @Type(() => CricketInningsScoreDto)
  homeSuperOver?: CricketInningsScoreDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CricketInningsScoreDto)
  awaySuperOver?: CricketInningsScoreDto;

  @IsOptional()
  @IsIn(['home', 'away'])
  superOverFirstBatting?: 'home' | 'away';
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
