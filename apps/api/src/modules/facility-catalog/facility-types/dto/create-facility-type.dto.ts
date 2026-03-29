import { IsOptional, IsString } from 'class-validator';

export class CreateFacilityTypeDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
