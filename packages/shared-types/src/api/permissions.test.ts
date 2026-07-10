import { describe, expect, it } from 'vitest';
import {
  isAdminRole,
  isClientRole,
  isStylistRole,
  PERMISSIONS,
  roleHasPermission,
  USER_ROLES,
} from './permissions.js';

describe('permissions', () => {
  it('identifies role categories', () => {
    expect(isStylistRole(USER_ROLES.STYLIST_OWNER)).toBe(true);
    expect(isStylistRole(USER_ROLES.CLIENT)).toBe(false);
    expect(isAdminRole(USER_ROLES.ADMIN)).toBe(true);
    expect(isClientRole(USER_ROLES.CLIENT)).toBe(true);
  });

  it('checks permission matrix membership', () => {
    expect(roleHasPermission('admin', PERMISSIONS.ADMIN_PLATFORM)).toBe(true);
    expect(roleHasPermission('client', PERMISSIONS.ADMIN_PLATFORM)).toBe(false);
    expect(roleHasPermission('stylist_staff', PERMISSIONS.STYLIST_DASHBOARD)).toBe(true);
  });
});
