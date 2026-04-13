import { IsDateString, IsIn, Matches } from 'class-validator';

export class PatchFacilitySlotDto {
  @IsDateString()
  date!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be HH:mm on a 30-minute boundary',
  })
  startTime!: string;

  @IsIn(['available', 'blocked'])
  status!: 'available' | 'blocked';
}
