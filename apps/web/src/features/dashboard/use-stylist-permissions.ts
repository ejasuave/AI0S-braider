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

export function useStylistPermissions(): BusinessStaffPermissions {
  const auth = useAuth();
  return auth.permissions ?? ALL_PERMISSIONS;
}

export function useCanViewPayouts(): boolean {
  return useStylistPermissions().can_view_payouts;
}
