import { describe, expect, it } from 'vitest';
import { applyEnvFile } from './load-env.js';

describe('applyEnvFile', () => {
  it('loads .env values when the shell exported an empty override', () => {
    const env: NodeJS.ProcessEnv = { STRIPE_SECRET_KEY: '' };
    applyEnvFile('STRIPE_SECRET_KEY=sk_test_from_dotenv\n', env);
    expect(env.STRIPE_SECRET_KEY).toBe('sk_test_from_dotenv');
  });

  it('keeps a non-empty shell override over .env', () => {
    const env: NodeJS.ProcessEnv = { STRIPE_SECRET_KEY: 'from_shell' };
    applyEnvFile('STRIPE_SECRET_KEY=from_dotenv\n', env);
    expect(env.STRIPE_SECRET_KEY).toBe('from_shell');
  });
});
