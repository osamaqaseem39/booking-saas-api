import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class UpdateBusinessOwnerDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

class UpdateBusinessSubscriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  plan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  billingCycle?: string;
}

class UpdateBusinessSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  allowOnlinePayments?: boolean;
}

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  vertical?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  businessType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  sportsOffered?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBusinessOwnerDto)
  owner?: UpdateBusinessOwnerDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBusinessSubscriptionDto)
  subscription?: UpdateBusinessSubscriptionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBusinessSettingsDto)
  settings?: UpdateBusinessSettingsDto;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'])
  status?: string;
}
