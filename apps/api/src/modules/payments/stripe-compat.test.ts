import { describe, expect, it, vi, afterEach } from 'vitest';

vi.mock('../../lib/stripe/index.js', () => ({
  isStripeMockMode: vi.fn(() => false),
}));

import { isStripeMockMode } from '../../lib/stripe/index.js';
import {
  isRecoverableConnectAccountError,
  isStaleMockConnectAccount,
  isStaleMockPaymentIntent,
} from './stripe-compat.js';

describe('stripe-compat', () => {
  afterEach(() => {
    vi.mocked(isStripeMockMode).mockReturnValue(false);
  });

  it('detects mock payment intents when live Stripe is active', () => {
    expect(isStaleMockPaymentIntent('pi_mock_abc123')).toBe(true);
    expect(isStaleMockPaymentIntent('pi_3RealStripeId')).toBe(false);
  });

  it('ignores mock payment intents in mock mode', () => {
    vi.mocked(isStripeMockMode).mockReturnValue(true);
    expect(isStaleMockPaymentIntent('pi_mock_abc123')).toBe(false);
  });

  it('detects mock connect accounts when live Stripe is active', () => {
    expect(isStaleMockConnectAccount('acct_mock_abc')).toBe(true);
    expect(isStaleMockConnectAccount('acct_1RealAccount')).toBe(false);
  });

  it('detects recoverable connect account errors', () => {
    expect(
      isRecoverableConnectAccountError(
        "The provided key does not have access to account 'acct_mock_x' (or that account does not exist).",
      ),
    ).toBe(true);
    expect(
      isRecoverableConnectAccountError('Signing up for Connect requires activating Connect'),
    ).toBe(false);
  });
});
