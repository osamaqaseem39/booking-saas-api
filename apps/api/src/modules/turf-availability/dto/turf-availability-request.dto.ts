import { IsDateString, IsIn, IsUUID } from 'class-validator';
import { TURF_SPORT_TYPES } from '../../turf/turf.types';

export class TurfAvailabilityRequestDto {
  @IsUUID('4')
  branchId!: string;

  @IsDateString()
  date!: string;

  @IsIn(TURF_SPORT_TYPES)
  sportType!: (typeof TURF_SPORT_TYPES)[number];
}
