import { describe, expect, it } from 'vitest';
import { OWNER_PERMISSIONS, resolvePermissionsForUser } from './resolve-permissions.js';

describe('resolvePermissionsForUser', () => {
  it('grants all permissions to stylist_owner', async () => {
    const permissions = await resolvePermissionsForUser('user-1', 'stylist_owner');
    expect(permissions).toEqual(OWNER_PERMISSIONS);
  });

  it('grants all permissions to admin', async () => {
    const permissions = await resolvePermissionsForUser('user-1', 'admin');
    expect(permissions).toEqual(OWNER_PERMISSIONS);
  });

  it('returns null for clients', async () => {
    const permissions = await resolvePermissionsForUser('user-1', 'client');
    expect(permissions).toBeNull();
  });
});
