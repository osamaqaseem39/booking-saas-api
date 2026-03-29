import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateCricketIndoorCourtDto {
  @IsString()
  name!: string;

  @IsUUID('4')
  businessLocationId!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  laneCount?: number;
}
