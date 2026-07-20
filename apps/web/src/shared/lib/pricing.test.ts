import { describe, expect, it } from 'vitest';
import {
  calculateBookingPriceSummary,
  calculateDepositAmount,
  remainingBalanceMethodLabel,
} from './pricing';

describe('pricing helpers', () => {
  it('calculates percentage and flat deposits', () => {
    expect(calculateDepositAmount(100, 'percentage', 20)).toBe(20);
    expect(calculateDepositAmount(50, 'flat', 80)).toBe(50);
  });

  it('includes add-ons in totals', () => {
    const summary = calculateBookingPriceSummary({
      basePrice: 100,
      addonPrices: [10, 15],
      homeVisitSurcharge: 5,
      depositType: 'percentage',
      depositValue: 20,
    });
    expect(summary.total).toBe(130);
    expect(summary.deposit).toBe(26);
    expect(summary.remaining).toBe(104);
  });

  it('labels remaining balance methods', () => {
    expect(remainingBalanceMethodLabel('cash')).toBe('Cash');
    expect(remainingBalanceMethodLabel('card')).toBe('Card');
    expect(remainingBalanceMethodLabel('cash_or_card')).toBe('Cash or Card');
    expect(remainingBalanceMethodLabel('bank_transfer')).toBe('Bank Transfer');
    expect(remainingBalanceMethodLabel('any')).toBe('Any Payment Method');
    expect(remainingBalanceMethodLabel(null)).toBe('Not specified');
  });
});
