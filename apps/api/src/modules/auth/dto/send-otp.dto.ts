import { IsEmail, IsIn, IsString } from 'class-validator';
import type { OtpPurpose } from '../entities/email-otp.entity';

export class SendOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsIn(['login', 'register'])
  purpose!: OtpPurpose;
}
