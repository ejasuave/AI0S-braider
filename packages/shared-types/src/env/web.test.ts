import { describe, expect, it } from 'vitest';
import { parseWebEnv } from './web.js';

describe('parseWebEnv', () => {
  it('allows pk_test_ on a staging surface', () => {
    const env = parseWebEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_API_URL: 'https://project-braids-api-staging.fly.dev',
      NEXT_PUBLIC_PLATFORM_DISPLAY_NAME: 'Project Braids (Staging)',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_abc123',
    });
    expect(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).toBe('pk_test_abc123');
  });

  it('ignores pk_live_ on a staging surface (disables Stripe.js)', () => {
    const env = parseWebEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_API_URL: 'https://project-braids-api-staging.fly.dev',
      NEXT_PUBLIC_PLATFORM_DISPLAY_NAME: 'Project Braids (Staging)',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_abc123',
    });
    expect(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).toBeUndefined();
  });

  it('allows pk_live_ on a non-staging production surface', () => {
    const env = parseWebEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_API_URL: 'https://api.projectbraids.app',
      NEXT_PUBLIC_PLATFORM_DISPLAY_NAME: 'Project Braids',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_abc123',
    });
    expect(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).toBe('pk_live_abc123');
  });
});
