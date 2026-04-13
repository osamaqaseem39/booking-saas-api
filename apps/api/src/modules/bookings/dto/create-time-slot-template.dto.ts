import { ArrayMinSize, IsArray, IsString, Matches, MaxLength } from 'class-validator';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateTimeSlotTemplateDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(HH_MM, { each: true, message: 'each slot start must be HH:mm (24h)' })
  slotStarts!: string[];
}
