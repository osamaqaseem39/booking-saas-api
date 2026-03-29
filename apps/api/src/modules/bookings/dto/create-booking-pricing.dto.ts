import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class CreateBookingPricingDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  subTotal!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discount!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  tax!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalAmount!: number;
}
