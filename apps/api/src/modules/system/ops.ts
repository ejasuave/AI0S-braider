import type { FastifyReply, FastifyRequest } from 'fastify';
import type { OpsStatusResponse } from '@project-braids/shared-types/api';
import { getEnv } from '../../config/env.js';
import { ApiError } from '../../lib/errors.js';

export async function requireOpsToken(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const env = getEnv();
  if (!env.OPS_BEARER_TOKEN) {
    return;
  }

  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError('UNAUTHORIZED', 'Ops bearer token required', 401);
  }

  const token = header.slice('Bearer '.length);
  if (token !== env.OPS_BEARER_TOKEN) {
    throw new ApiError('UNAUTHORIZED', 'Invalid ops bearer token', 401);
  }
}

export function buildOpsStatus(): OpsStatusResponse {
  const env = getEnv();
  const aiEnabled = env.AI_RECEPTIONIST_ENABLED;

  return {
    service: 'api',
    environment: env.DEPLOY_ENV ?? env.NODE_ENV,
    version: env.APP_VERSION,
    gitSha: env.GIT_SHA ?? null,
    aiReceptionistEnabled: aiEnabled,
    killSwitchActive: !aiEnabled,
    timestamp: new Date().toISOString(),
  };
}
