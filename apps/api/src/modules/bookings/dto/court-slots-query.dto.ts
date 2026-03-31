import { IsDateString } from 'class-validator';

export class CourtSlotsQueryDto {
  @IsDateString()
  date!: string;
}
