import { IsDateString } from 'class-validator';

export class GenerateFacilitySlotsDto {
  @IsDateString()
  date!: string;
}
