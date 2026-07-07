import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Require one or more `${module}:${action}` permissions for business-staff.
 * Admin roles (platform-owner / business-admin / location-admin) bypass this.
 * The route must also be protected by `RolesGuard`.
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
