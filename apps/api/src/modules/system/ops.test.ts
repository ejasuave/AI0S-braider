import { describe, expect, it } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '../../lib/errors.js';
import { buildOpsStatus, requireOpsToken } from './ops.js';
import { setEnvForTest } from '../../test/env.js';

describe('system ops', () => {
  it('reports AI enabled and environment from DEPLOY_ENV', () => {
    setEnvForTest({ AI_RECEPTIONIST_ENABLED: 'true', DEPLOY_ENV: 'development' });
    const status = buildOpsStatus();
    expect(status.aiReceptionistEnabled).toBe(true);
    expect(status.killSwitchActive).toBe(false);
    expect(status.environment).toBe('development');
  });

  it('reports kill switch active when AI is disabled', () => {
    setEnvForTest({ AI_RECEPTIONIST_ENABLED: 'false', DEPLOY_ENV: 'staging' });
    const status = buildOpsStatus();
    expect(status.killSwitchActive).toBe(true);
    expect(status.environment).toBe('staging');
  });

  it('requires bearer token when OPS_BEARER_TOKEN is set', async () => {
    setEnvForTest({ OPS_BEARER_TOKEN: 'test-ops-token-16chars' });

    await expect(
      requireOpsToken({ headers: {} } as FastifyRequest, {} as FastifyReply),
    ).rejects.toThrow(ApiError);

    await expect(
      requireOpsToken(
        { headers: { authorization: 'Bearer test-ops-token-16chars' } } as FastifyRequest,
        {} as FastifyReply,
      ),
    ).resolves.toBeUndefined();
  });

  it('allows ops status without token when OPS_BEARER_TOKEN unset', async () => {
    setEnvForTest({});
    await expect(
      requireOpsToken({ headers: {} } as FastifyRequest, {} as FastifyReply),
    ).resolves.toBeUndefined();
  });
});
