import { IsIn, IsString } from 'class-validator';
import { SYSTEM_ROLES } from '../iam.constants';

export class AssignRoleDto {
  @IsString()
  userId!: string;

  @IsIn(SYSTEM_ROLES)
  role!: (typeof SYSTEM_ROLES)[number];
}
