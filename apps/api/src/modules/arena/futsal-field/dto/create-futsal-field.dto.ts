import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateFutsalFieldDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsUUID('4')
  businessLocationId!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  dimensions?: string;
}
