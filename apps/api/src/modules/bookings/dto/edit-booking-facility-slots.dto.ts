import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class EditBookingFacilitySlotsDto {
  @IsOptional()
  @IsBoolean()
  blocked?: boolean;

  @IsOptional()
  @IsIn([30, 60])
  addOnMinutes?: 30 | 60;
}
