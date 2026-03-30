import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterEndUserDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @MinLength(7)
  phone?: string;
}
