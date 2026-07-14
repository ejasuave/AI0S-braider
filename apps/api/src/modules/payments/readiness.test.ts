import { describe, expect, it } from 'vitest';
import { isPaymentReady } from './readiness.js';

describe('isPaymentReady', () => {
  it('is exported for booking hold gating', () => {
    expect(typeof isPaymentReady).toBe('function');
  });
});
