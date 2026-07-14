import { prisma } from '../lib/db.js';

/** Prisma Dev + pgbouncer can leave the singleton client in a bad state after a failed query. */
export async function ensurePrismaConnection(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    await prisma.$disconnect();
    await prisma.$connect();
  }
}
