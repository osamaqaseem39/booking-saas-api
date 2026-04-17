import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class InitiatePaymentDto {
  @IsString()
  @IsNotEmpty()
  gateway: 'easypaisa' | 'jazzcash';

  @IsNumber()
  amount: number;

  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsOptional()
  customerMobile?: string;

  @IsString()
  @IsOptional()
  customerEmail?: string;
}
