export const SYSTEM_ROLES = [
  'platform-owner',
  'business-admin',
  'location-admin',
  'business-staff',
  'customer-end-user',
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];
