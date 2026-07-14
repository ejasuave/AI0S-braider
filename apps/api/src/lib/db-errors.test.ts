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

  it('detects known connection request codes', () => {
    const error = new Prisma.PrismaClientKnownRequestError("Can't reach database server", {
      code: 'P1001',
      clientVersion: '5.0.0',
    });
    expect(isDatabaseUnavailableError(error)).toBe(true);
  });

  it('does not treat unique/constraint violations as database unavailable', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
      meta: { target: ['booking_id'] },
    });
    expect(isDatabaseUnavailableError(error)).toBe(false);
  });

  it('ignores unrelated errors', () => {
    expect(isDatabaseUnavailableError(new Error('Invalid credentials'))).toBe(false);
  });
});
