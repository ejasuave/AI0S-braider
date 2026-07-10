import { describe, expect, it } from 'vitest';
import { parseApiEnv } from './api.js';

describe('parseApiEnv', () => {
  it('parses required database url', () => {
    const env = parseApiEnv({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/braids',
    });
    expect(env.PORT).toBe(3001);
    expect(env.DATABASE_URL).toContain('postgresql');
  });

  it('rejects invalid database url', () => {
    expect(() => parseApiEnv({ DATABASE_URL: 'not-a-url' })).toThrow();
  });
});
