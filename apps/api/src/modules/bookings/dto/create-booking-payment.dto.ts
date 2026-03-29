import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { PAYMENT_METHODS, PAYMENT_STATUSES, type PaymentMethod, type PaymentStatus } from '../booking.types';

export class CreateBookingPaymentDto {
  @IsIn([...PAYMENT_STATUSES])
  paymentStatus!: PaymentStatus;

  @IsIn([...PAYMENT_METHODS])
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
