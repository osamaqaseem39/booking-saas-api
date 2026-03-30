import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBusinessAdminDto {
  @IsString()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
