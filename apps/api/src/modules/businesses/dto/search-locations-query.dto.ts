import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';

export class SearchLocationsQueryDto {
  /** Comma-separated city names (case-insensitive match on location city). */
  @IsOptional()
  @IsString()
  cities?: string;

  @IsOptional()
  @IsString()
  locationType?: string;

  @IsOptional()
  @IsIn(['unbooked'])
  bookingStatus?: 'unbooked';

  @ValidateIf((o) => o.bookingStatus === 'unbooked')
  @IsNotEmpty()
  @IsDateString()
  date?: string;

  @ValidateIf((o) => o.bookingStatus === 'unbooked')
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be HH:mm (24h)',
  })
  startTime?: string;

  @ValidateIf((o) => o.bookingStatus === 'unbooked')
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be HH:mm (24h)',
  })
  endTime?: string;
}
