import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePromoCodeDto {
  @IsString()
  @MaxLength(32)
  code!: string;

  @IsIn(['percent', 'fixed'])
  discountType!: 'percent' | 'fixed';

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discountValue!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minSubTotal?: number;

  @IsOptional()
  @IsString()
  validFrom?: string;

  @IsOptional()
  @IsString()
  validTo?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  maxUses?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePromoCodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsOptional()
  @IsIn(['percent', 'fixed'])
  discountType?: 'percent' | 'fixed';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discountValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minSubTotal?: number | null;

  @IsOptional()
  @IsString()
  validFrom?: string | null;

  @IsOptional()
  @IsString()
  validTo?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  maxUses?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ValidatePromoCodeDto {
  @IsString()
  @MaxLength(32)
  code!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  subTotal!: number;
}
