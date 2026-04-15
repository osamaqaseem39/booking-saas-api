import { IsArray, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  fullName: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsArray()
  roles?: string[];
}
