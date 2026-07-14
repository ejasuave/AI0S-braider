import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { loadRepoEnv } from './src/test/load-repo-env.js';
import { resolveTestDatabaseUrl } from './src/test/database-url.js';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
loadRepoEnv(repoRoot);

const prismaDev = /:5121\d/.test(resolveTestDatabaseUrl());

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    env: {
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
    },
    maxWorkers: prismaDev ? 1 : undefined,
    fileParallelism: !prismaDev,
  },
});
