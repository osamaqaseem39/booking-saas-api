import { IsBoolean } from 'class-validator';

export class EditBookingFacilitySlotsDto {
  @IsBoolean()
  blocked!: boolean;
}
