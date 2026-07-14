import { describe, expect, it } from 'vitest';
import { mapV1ConnectAccount, mapV2ConnectAccount } from './connect-v2.js';

const activeRecipientConfig = {
  recipient: {
    applied: true,
    capabilities: {
      stripe_balance: {
        stripe_transfers: { status: 'active' as const, status_details: [] },
      },
    },
  },
};

describe('connect-v2 mappers', () => {
  it('maps V2 recipient transfers as charges enabled when eventually_due', () => {
    const status = mapV2ConnectAccount({
      id: 'acct_v2_test',
      object: 'v2.core.account',
      applied_configurations: ['recipient'],
      created: '2026-01-01T00:00:00.000Z',
      livemode: false,
      configuration: activeRecipientConfig,
      requirements: {
        summary: {
          minimum_deadline: { status: 'eventually_due' },
        },
      },
    });

    expect(status.chargesEnabled).toBe(true);
    expect(status.onboardingComplete).toBe(true);
  });

  it('treats empty requirements with active transfers as onboarding complete', () => {
    const status = mapV2ConnectAccount({
      id: 'acct_v2_complete',
      object: 'v2.core.account',
      applied_configurations: ['recipient', 'merchant'],
      created: '2026-01-01T00:00:00.000Z',
      livemode: false,
      configuration: activeRecipientConfig,
      requirements: {
        entries: [],
        summary: null as unknown as undefined,
      },
    });

    expect(status.chargesEnabled).toBe(true);
    expect(status.onboardingComplete).toBe(true);
    expect(status.restricted).toBe(false);
  });

  it('maps legacy V1 express accounts', () => {
    const status = mapV1ConnectAccount({
      id: 'acct_v1_test',
      object: 'account',
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    } as never);

    expect(status.chargesEnabled).toBe(true);
    expect(status.onboardingComplete).toBe(true);
  });
});
