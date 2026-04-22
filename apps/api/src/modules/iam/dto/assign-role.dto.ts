import { IsIn, IsString, IsOptional } from 'class-validator';
import { SYSTEM_ROLES } from '../iam.constants';

export class AssignRoleDto {
  @IsString()
  userId!: string;

  @IsIn(SYSTEM_ROLES)
  role!: (typeof SYSTEM_ROLES)[number];

  @IsOptional()
  @IsString()
  locationId?: string;
}
