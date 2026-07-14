import { describe, expect, it } from 'vitest';
import { filterStylistNavItems } from './bottom-nav-items';

describe('filterStylistNavItems', () => {
  it('hides Pay when can_view_payouts is false', () => {
    const items = filterStylistNavItems({
      can_manage_bookings: true,
      can_manage_pricing: false,
      can_manage_profile: false,
      can_view_payouts: false,
      can_manage_staff: false,
    });

    expect(items.map((item) => item.href)).not.toContain('/stylist/payments');
    expect(items.map((item) => item.href)).toContain('/stylist/inbox');
  });

  it('shows Pay when can_view_payouts is true', () => {
    const items = filterStylistNavItems({
      can_manage_bookings: false,
      can_manage_pricing: false,
      can_manage_profile: false,
      can_view_payouts: true,
      can_manage_staff: false,
    });

    expect(items.map((item) => item.href)).toContain('/stylist/payments');
  });
});
