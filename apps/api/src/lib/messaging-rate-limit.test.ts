import { describe, expect, it } from 'vitest';
import { getEnv, resetEnvCache } from '../config/env.js';
import {
  assertInboundMessagingAllowed,
  resetMessagingRateLimitForTests,
} from './messaging-rate-limit.js';

describe('assertInboundMessagingAllowed', () => {
  it('throttles inbound message floods from a single phone number', async () => {
    resetEnvCache();
    resetMessagingRateLimitForTests();
    process.env.MESSAGING_RATE_LIMIT_MAX = '3';
    process.env.MESSAGING_RATE_LIMIT_WINDOW_MS = '60000';
    resetEnvCache();

    const env = getEnv();
    const phone = '+447700900999';

    await assertInboundMessagingAllowed(phone);
    await assertInboundMessagingAllowed(phone);
    await assertInboundMessagingAllowed(phone);

    await expect(assertInboundMessagingAllowed(phone)).rejects.toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMITED',
    });

    process.env.MESSAGING_RATE_LIMIT_MAX = String(env.MESSAGING_RATE_LIMIT_MAX);
    resetEnvCache();
    resetMessagingRateLimitForTests();
  });
});
