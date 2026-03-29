import { IsNumber, IsPositive, IsString } from 'class-validator';

export class IssueInvoiceDto {
  @IsString()
  bookingId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}
