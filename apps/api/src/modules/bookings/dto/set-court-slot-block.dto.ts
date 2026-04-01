import { IsBoolean, IsDateString, Matches } from 'class-validator';

export class SetCourtSlotBlockDto {
  @IsDateString()
  date!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be HH:mm on a 30-minute boundary',
  })
  startTime!: string;

  /** When true, booking is disabled for this 30-minute slot; when false, remove block (allow booking). */
  @IsBoolean()
  blocked!: boolean;
}
