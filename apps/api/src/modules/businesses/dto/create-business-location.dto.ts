import {
  IsLatitude,
  IsLongitude,
  IsObject,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BUSINESS_LOCATION_TYPE_CODES } from '../business-location.constants';

class CoordinatesDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

class LocationMetaDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  address?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;
}

class ContactMetaDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  manager?: string;
}

class SettingsMetaDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}

export class CreateBusinessLocationDto {
  @IsUUID('4')
  businessId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @IsIn(BUSINESS_LOCATION_TYPE_CODES)
  locationType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  facilityTypes?: string[];

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  arenaId?: string;

  @IsOptional()
  @IsString()
  addressLine?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  manager?: string;

  @IsOptional()
  @IsObject()
  workingHours?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationMetaDto)
  location?: LocationMetaDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactMetaDto)
  contact?: ContactMetaDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SettingsMetaDto)
  settings?: SettingsMetaDto;

  @IsOptional()
  @IsString()
  branchName?: string;
}
