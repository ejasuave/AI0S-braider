import { describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getWebEnv: () => ({
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_example',
  }),
}));

import {
  incompatibleMockClientSecretMessage,
  isIncompatibleMockClientSecret,
  isMockClientSecret,
} from './deposit-checkout';

describe('deposit checkout helpers', () => {
  it('detects mock client secrets', () => {
    expect(isMockClientSecret('pi_mock_abc123_secret_mock')).toBe(true);
    expect(isMockClientSecret('pi_3RealStripeSecret')).toBe(false);
  });

  it('treats mock secrets as incompatible when a publishable key is configured', () => {
    expect(isIncompatibleMockClientSecret('pi_mock_abc123_secret_mock')).toBe(true);
  });

  it('explains the web/API Stripe mismatch', () => {
    expect(incompatibleMockClientSecretMessage()).toMatch(/STRIPE_SECRET_KEY/);
    expect(incompatibleMockClientSecretMessage()).toMatch(/test publishable key/);
  });
});
