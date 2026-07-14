import { resetEnvCache } from '../config/env.js';
import { resolveTestDatabaseUrl } from './database-url.js';

const BASE_TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: resolveTestDatabaseUrl(),
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
  AI_RECEPTIONIST_ENABLED: 'true',
};

export function setEnvForTest(overrides: Record<string, string> = {}): void {
  const merged = { ...BASE_TEST_ENV, ...overrides };
  for (const key of ['OPS_BEARER_TOKEN', 'GIT_SHA', 'APP_VERSION', 'DEPLOY_ENV']) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(merged)) {
    process.env[key] = value;
  }
  resetEnvCache();
}
