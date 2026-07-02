import { IsEmail, IsString, Length } from 'class-validator';

export class LoginOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;
}
