import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach } from 'vitest';
import { loadRepoEnv } from './src/test/load-repo-env.js';
import { resolveTestDatabaseUrl } from './src/test/database-url.js';
import { truncatePublicTables } from './src/test/truncate-public-tables.js';
import { seedReferenceData } from './src/test/seed-reference-data.js';
import { ensurePrismaConnection } from './src/test/ensure-prisma-connection.js';
import { resetEnvCache } from './src/config/env.js';
import { resetStripeProvider } from './src/lib/stripe/index.js';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
loadRepoEnv(repoRoot);

process.env.DATABASE_URL = resolveTestDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: unknown };
delete globalForPrisma.prisma;

process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_SECRET ??= 'test-jwt-secret-at-least-32-characters-long';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.BOOKING_HOLD_TTL_MINUTES ??= '15';
process.env.PLATFORM_TIMEZONE ??= 'Europe/London';
process.env.AVAILABILITY_SLOT_INTERVAL_MINUTES ??= '15';
process.env.AVAILABILITY_MAX_DAYS ??= '14';
process.env.AI_RECEPTIONIST_ENABLED ??= 'true';

// Payment + Stripe route tests inject MockStripeProvider — avoid treating acct_mock_* as stale.
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;
resetEnvCache();
resetStripeProvider();

if (/:5121\d/.test(process.env.DATABASE_URL)) {
  await truncatePublicTables(process.env.DATABASE_URL);
  await seedReferenceData(process.env.DATABASE_URL);
}

afterEach(async () => {
  if (/:5121\d/.test(process.env.DATABASE_URL ?? '')) {
    await ensurePrismaConnection();
  }
});
