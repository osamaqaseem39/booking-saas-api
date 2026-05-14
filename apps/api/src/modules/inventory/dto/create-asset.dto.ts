import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAssetDto {
  @IsUUID()
  locationId!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsString()
  @MaxLength(100)
  type!: string;

  @IsInt()
  @Min(0)
  totalQuantity!: number;

  @IsInt()
  @Min(0)
  availableQuantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rentalPrice?: number | null;
}
