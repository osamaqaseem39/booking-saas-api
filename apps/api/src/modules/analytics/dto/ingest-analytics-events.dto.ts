import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class AnalyticsContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  app_version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  build_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  os_version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

export class AnalyticsAppDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  build?: string;
}

export class AnalyticsDeviceDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

export class AnalyticsEventItemDto {
  @IsString()
  @MaxLength(64)
  event_id!: string;

  @IsString()
  @MaxLength(64)
  event_name!: string;

  @IsOptional()
  @IsString()
  occurred_at?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  anonymous_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  session_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  screen_name?: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnalyticsContextDto)
  context?: AnalyticsContextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnalyticsAppDto)
  app?: AnalyticsAppDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnalyticsDeviceDto)
  device?: AnalyticsDeviceDto;
}

export class IngestAnalyticsEventsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AnalyticsEventItemDto)
  events!: AnalyticsEventItemDto[];
}
