import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateBusinessAdminDto {
  @IsString()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
