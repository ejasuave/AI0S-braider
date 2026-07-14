import { describe, expect, it } from 'vitest';
import { isStaffMembershipActive, staffHasPermission } from './permissions.js';

describe('roles permissions helpers', () => {
  const activeStaff = {
    acceptedAt: new Date(),
    removedAt: null,
    permissions: {
      can_manage_bookings: true,
      can_manage_pricing: false,
      can_view_payouts: false,
      can_manage_staff: false,
    },
  };

  it('treats pending invitations as inactive', () => {
    expect(isStaffMembershipActive({ acceptedAt: null, removedAt: null })).toBe(false);
    expect(staffHasPermission({ ...activeStaff, acceptedAt: null }, 'can_manage_bookings')).toBe(
      false,
    );
  });

  it('treats removed staff as inactive even when permission flag is true', () => {
    expect(
      staffHasPermission({ ...activeStaff, removedAt: new Date() }, 'can_manage_bookings'),
    ).toBe(false);
  });

  it('grants permission only when membership is active and flag is true', () => {
    expect(staffHasPermission(activeStaff, 'can_manage_bookings')).toBe(true);
    expect(staffHasPermission(activeStaff, 'can_manage_staff')).toBe(false);
  });
});
