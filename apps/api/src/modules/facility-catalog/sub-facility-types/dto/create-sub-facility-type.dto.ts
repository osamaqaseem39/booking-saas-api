import { IsOptional, IsString } from 'class-validator';

export class CreateSubFacilityTypeDto {
  @IsString()
  facilityTypeId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
