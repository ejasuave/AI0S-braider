import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { isDatabaseUnavailableError } from './db-errors.js';

describe('isDatabaseUnavailableError', () => {
  it('detects Prisma connection failures', () => {
    const error = new Prisma.PrismaClientInitializationError(
      "Can't reach database server at `localhost:51214`",
      '5.0.0',
    );
    expect(isDatabaseUnavailableError(error)).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isDatabaseUnavailableError(new Error('Invalid credentials'))).toBe(false);
  });
});
