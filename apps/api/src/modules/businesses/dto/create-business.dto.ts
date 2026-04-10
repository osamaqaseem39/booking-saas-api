import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBusinessAdminDto } from './create-business-admin.dto';

class CreateBusinessOwnerDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

class CreateBusinessSubscriptionDto {
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

class CreateBusinessSettingsDto {
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

export class CreateBusinessDto {
  @IsOptional()
  @IsUUID('4')
  tenantId?: string;

  @IsString()
  businessName!: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateBusinessOwnerDto)
  owner?: CreateBusinessOwnerDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateBusinessSubscriptionDto)
  subscription?: CreateBusinessSubscriptionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateBusinessSettingsDto)
  settings?: CreateBusinessSettingsDto;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'])
  status?: string;

  // Backward-compatible shape used by existing dashboard.
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateBusinessAdminDto)
  admin?: CreateBusinessAdminDto;
}
