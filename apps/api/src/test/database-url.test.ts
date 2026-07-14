import { afterEach, describe, expect, it } from 'vitest';
import { resolveTestDatabaseUrl } from './database-url.js';

describe('resolveTestDatabaseUrl', () => {
  const previous = {
    test: process.env.TEST_DATABASE_URL,
    db: process.env.DATABASE_URL,
  };

  afterEach(() => {
    process.env.TEST_DATABASE_URL = previous.test;
    process.env.DATABASE_URL = previous.db;
  });

  it('maps Prisma Dev braids_dev to braids_test and keeps pgbouncer compat', () => {
    delete process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:51214/braids_dev?sslmode=disable&pgbouncer=true';
    expect(resolveTestDatabaseUrl()).toBe(
      'postgresql://postgres:postgres@localhost:51214/braids_test?sslmode=disable&pgbouncer=true&connection_limit=1',
    );
  });

  it('leaves CI docker URL unchanged', () => {
    delete process.env.TEST_DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(resolveTestDatabaseUrl()).toBe('postgresql://braids:braids@localhost:5432/braids_test');
  });
});
