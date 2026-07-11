import { describe, expect, it } from 'vitest';
import { DEFAULT_BUSINESS_POLICY } from '@project-braids/shared-types/api';
import { evaluateCancellationDeposit, evaluateNoShowDeposit } from './policy.js';

const testPolicy = {
  ...DEFAULT_BUSINESS_POLICY,
  businessId: '11111111-1111-4111-8111-111111111111',
};

describe('booking policy evaluation', () => {
  it('returns full_refund inside cancellation window', () => {
    const disposition = evaluateCancellationDeposit(
      testPolicy,
      { startTime: new Date('2026-08-10T10:00:00.000Z') },
      new Date('2026-08-08T10:00:00.000Z'),
    );
    expect(disposition).toBe('full_refund');
  });

  it('returns forfeit_deposit outside cancellation window', () => {
    const disposition = evaluateCancellationDeposit(
      testPolicy,
      { startTime: new Date('2026-08-10T10:00:00.000Z') },
      new Date('2026-08-10T08:00:00.000Z'),
    );
    expect(disposition).toBe('forfeit_deposit');
  });

  it('returns forfeit_deposit for default no-show policy', () => {
    expect(evaluateNoShowDeposit(testPolicy)).toBe('forfeit_deposit');
  });
});
