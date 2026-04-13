import { IsDateString, IsIn, IsOptional, Matches } from 'class-validator';

export class CourtSlotGridQueryDto {
  @IsDateString()
  date!: string;

  /** Inclusive grid start (HH:mm, 30-minute aligned). Default 00:00. */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be HH:mm (24h)',
  })
  startTime?: string;

  /** Exclusive grid end (HH:mm or 24:00, 30-minute aligned). Default 24:00. */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, {
    message: 'endTime must be HH:mm or 24:00',
  })
  endTime?: string;

  /**
   * Optional informational overlay: when `true`, grid bounds follow the court's location
   * `workingHours` for `date` (ignored if `startTime`/`endTime` are set).
   * Booking enforcement still depends on bookings + slot blocks.
   */
  @IsOptional()
  @IsIn(['true', 'false'])
  useWorkingHours?: string;

  /**
   * When `true`, only bookable (free) 30-minute segments are returned — booked
   * intervals are omitted so pickers do not show taken slots.
   */
  @IsOptional()
  @IsIn(['true', 'false'])
  availableOnly?: string;
}
