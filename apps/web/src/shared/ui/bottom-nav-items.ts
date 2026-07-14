import type { BusinessStaffPermissions } from '@project-braids/shared-types/api';

export type StylistNavItem = {
  href: string;
  label: string;
  permission?: keyof BusinessStaffPermissions;
};

export const STYLIST_NAV_ITEMS: StylistNavItem[] = [
  { href: '/stylist', label: 'Home' },
  { href: '/stylist/bookings', label: 'Calendar' },
  { href: '/stylist/inbox', label: 'Inbox' },
  { href: '/stylist/payments', label: 'Pay', permission: 'can_view_payouts' },
  { href: '/stylist/more', label: 'More' },
];

export function filterStylistNavItems(permissions: BusinessStaffPermissions): StylistNavItem[] {
  return STYLIST_NAV_ITEMS.filter((item) => !item.permission || permissions[item.permission]);
}
