import { describe, expect, it } from 'vitest';
import { parseApiEnv } from './api.js';

describe('parseApiEnv', () => {
  it('parses required database url', () => {
    const env = parseApiEnv({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/braids',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
    });
    expect(env.PORT).toBe(3001);
    expect(env.DATABASE_URL).toContain('postgresql');
  });

  it('rejects invalid database url', () => {
    expect(() => parseApiEnv({ DATABASE_URL: 'not-a-url' })).toThrow();
  });
});
