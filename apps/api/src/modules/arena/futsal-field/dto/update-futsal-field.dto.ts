import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFutsalFieldDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  dimensions?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
