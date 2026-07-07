import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const HH_MM_END = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

export class CreateTimeSlotTemplateLineDto {
  @IsString()
  @Matches(HH_MM, { message: 'startTime must be HH:mm (24h)' })
  startTime!: string;

  @IsString()
  @Matches(HH_MM_END, { message: 'endTime must be HH:mm or 24:00 (24h)' })
  endTime!: string;

  @IsOptional()
  @IsString()
  @IsIn(['available', 'blocked'])
  status?: 'available' | 'blocked';

  @IsOptional()
  @IsString()
  @IsIn(['standard', 'peak'])
  priceTier?: 'standard' | 'peak';
}

export class CreateTimeSlotTemplateDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  /** Backward-compatible input. */
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @Matches(HH_MM, {
    each: true,
    message: 'each slot start must be HH:mm (24h)',
  })
  slotStarts?: string[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateTimeSlotTemplateLineDto)
  slotLines?: CreateTimeSlotTemplateLineDto[];
}
