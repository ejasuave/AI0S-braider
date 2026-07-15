import { describe, expect, it } from 'vitest';
import { resolveCorsOrigin } from './cors.js';

function resolve(
  env: Parameters<typeof resolveCorsOrigin>[0],
  origin: string | undefined,
): boolean | string {
  const handler = resolveCorsOrigin(env);
  let result: boolean | string = false;
  handler(origin, (_err, allow) => {
    result = allow;
  });
  return result;
}

const stagingEnv = {
  NODE_ENV: 'staging',
  CORS_ORIGIN: 'https://ai-0-s-braider-web.vercel.app',
  WEB_APP_URL: 'https://ai-0-s-braider-web.vercel.app',
} as Parameters<typeof resolveCorsOrigin>[0];

const localEnv = {
  NODE_ENV: 'development',
  CORS_ORIGIN: 'http://localhost:3000',
  WEB_APP_URL: 'http://localhost:3000',
} as Parameters<typeof resolveCorsOrigin>[0];

describe('resolveCorsOrigin', () => {
  it('echoes the primary web origin in staging (credentials-safe)', () => {
    expect(resolve(stagingEnv, 'https://ai-0-s-braider-web.vercel.app')).toBe(
      'https://ai-0-s-braider-web.vercel.app',
    );
  });

  it('allows localhost against staging when listed in the allowlist', () => {
    expect(resolve(stagingEnv, 'http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('rejects unknown origins', () => {
    expect(resolve(stagingEnv, 'https://evil.example')).toBe(false);
  });

  it('echoes localhost in development', () => {
    expect(resolve(localEnv, 'http://localhost:3000')).toBe('http://localhost:3000');
    expect(resolve(localEnv, 'http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
  });
});
