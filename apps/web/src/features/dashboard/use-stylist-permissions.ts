'use client';

import { useAuth } from '@/features/auth/auth-context';
import type { BusinessStaffPermissions } from '@project-braids/shared-types/api';

const ALL_PERMISSIONS: BusinessStaffPermissions = {
  can_manage_bookings: true,
  can_manage_pricing: true,
  can_manage_profile: true,
  can_view_payouts: true,
  can_manage_staff: true,
};

const STAFF_LOADING_PERMISSIONS: BusinessStaffPermissions = {
  can_manage_bookings: true,
  can_manage_pricing: false,
  can_manage_profile: false,
  can_view_payouts: false,
  can_manage_staff: false,
};

export function useStylistPermissions(): BusinessStaffPermissions {
  const auth = useAuth();
  if (auth.permissions) return auth.permissions;
  // Owners keep full access while /auth/me loads; staff never flash owner-only nav.
  if (auth.user?.role === 'stylist_staff') return STAFF_LOADING_PERMISSIONS;
  return ALL_PERMISSIONS;
}

export function useCanViewPayouts(): boolean {
  return useStylistPermissions().can_view_payouts;
}

export function useIsBusinessStaff(): boolean {
  return useAuth().user?.role === 'stylist_staff';
}
