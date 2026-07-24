import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AnalyticsReportQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  event_name?: string;

  @IsOptional()
  @IsUUID('4')
  location_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  app_version?: string;
}
