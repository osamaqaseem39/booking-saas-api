import { IsIn, IsUUID } from 'class-validator';
import type { CourtKind } from '../../bookings/booking.types';

export class CreateTurfTwinLinkDto {
  @IsUUID('4')
  futsalCourtId!: string;

  @IsUUID('4')
  cricketCourtId!: string;
}

const LINKABLE_COURT_KINDS = ['futsal_court', 'cricket_court'] as const;

export class RemoveTurfTwinLinkDto {
  @IsIn(LINKABLE_COURT_KINDS)
  courtKind!: Extract<CourtKind, 'futsal_court' | 'cricket_court'>;

  @IsUUID('4')
  courtId!: string;
}
