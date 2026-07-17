import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRegistrationDto {
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected', 'waitlisted'])
  status?: 'pending' | 'approved' | 'rejected' | 'waitlisted';

  @IsOptional()
  @IsIn(['pending', 'paid'])
  paymentStatus?: 'pending' | 'paid';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectedReason?: string;
}
