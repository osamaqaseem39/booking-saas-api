import { ValidateNested, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBusinessAdminDto } from './create-business-admin.dto';

export class CreateBusinessDto {
  @IsString()
  businessName!: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsString()
  vertical!: string;

  @ValidateNested()
  @Type(() => CreateBusinessAdminDto)
  admin!: CreateBusinessAdminDto;
}
