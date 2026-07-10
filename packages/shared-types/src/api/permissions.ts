import type { UserRole } from './auth.js';

/** Platform roles — must match Prisma `user_role` enum and JWT claims. */
export const USER_ROLES = {
  STYLIST_OWNER: 'stylist_owner',
  STYLIST_STAFF: 'stylist_staff',
  CLIENT: 'client',
  ADMIN: 'admin',
} as const satisfies Record<string, UserRole>;

/** Roles that operate within a stylist tenant scope. */
export const STYLIST_ROLES: UserRole[] = [USER_ROLES.STYLIST_OWNER, USER_ROLES.STYLIST_STAFF];

export function isStylistRole(role: UserRole): boolean {
  return STYLIST_ROLES.includes(role);
}

export function isAdminRole(role: UserRole): boolean {
  return role === USER_ROLES.ADMIN;
}

export function isClientRole(role: UserRole): boolean {
  return role === USER_ROLES.CLIENT;
}

/**
 * Permission matrix (MVP). Feature modules add rows as they ship.
 * V2: stylist_staff scoping (Ch.4.3), admin impersonation (Ch.4.4).
 */
export const PERMISSIONS = {
  /** Platform administration */
  ADMIN_PLATFORM: [USER_ROLES.ADMIN],
  /** Stylist dashboard and business configuration */
  STYLIST_DASHBOARD: STYLIST_ROLES,
  /** Client booking history and preferences */
  CLIENT_SELF: [USER_ROLES.CLIENT],
  /** Any authenticated user */
  AUTHENTICATED: [
    USER_ROLES.ADMIN,
    USER_ROLES.STYLIST_OWNER,
    USER_ROLES.STYLIST_STAFF,
    USER_ROLES.CLIENT,
  ],
} as const satisfies Record<string, readonly UserRole[]>;

export function roleHasPermission(role: UserRole, allowedRoles: readonly UserRole[]): boolean {
  return allowedRoles.includes(role);
}
