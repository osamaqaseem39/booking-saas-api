import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @IsUUID()
  locationId!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsDateString()
  date!: string;

  @IsString()
  @MaxLength(100)
  category!: string;
}
