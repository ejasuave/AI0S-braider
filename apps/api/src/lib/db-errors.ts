import { Prisma } from '@prisma/client';

/**
 * True only for infrastructure/connectivity failures — not application-level
 * Prisma errors (unique violations, missing records, schema mismatches, etc.).
 */
export function isDatabaseUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  if (error.name === 'PrismaClientInitializationError') {
    return true;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P1001' ||
      error.code === 'P1002' ||
      error.code === 'P1017' ||
      error.code === 'P1008')
  ) {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("can't reach database server") ||
    message.includes('connection refused') ||
    message.includes('econnrefused') ||
    message.includes('server has closed the connection') ||
    (message.includes('database server') && message.includes("can't reach"))
  );
}
