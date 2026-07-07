export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export interface PermissionModule {
  key: string;
  label: string;
  actions: PermissionAction[];
}

/**
 * Catalog of modules and the sub-actions that can be granted to business-staff.
 * Admin roles (platform-owner / business-admin / location-admin) bypass these
 * checks and always have full access.
 */
export const PERMISSION_MODULES: PermissionModule[] = [
  { key: 'bookings', label: 'Bookings', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'calendar', label: 'Calendar', actions: ['view'] },
  { key: 'tournaments', label: 'Tournaments', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'liveview', label: 'Live view', actions: ['view'] },
  { key: 'whatsapp', label: 'WhatsApp bot', actions: ['view', 'edit'] },
  { key: 'payments', label: 'Payments', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'expenses', label: 'Expenses', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'inventory', label: 'Inventory', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'canteen', label: 'Canteen', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'users', label: 'Users', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'locations', label: 'Locations', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'facilities', label: 'Facilities', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'timeslots', label: 'Booking slots', actions: ['view', 'create', 'edit', 'delete'] },
];

/** All valid `${module}:${action}` permission keys. */
export const ALL_PERMISSION_KEYS: string[] = PERMISSION_MODULES.flatMap((m) =>
  m.actions.map((a) => `${m.key}:${a}`),
);

export function isValidPermissionKey(key: string): boolean {
  return ALL_PERMISSION_KEYS.includes(key);
}
