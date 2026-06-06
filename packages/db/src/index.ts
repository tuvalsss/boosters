// Shared Prisma client + re-exported types for the Boosters monorepo.
//
// A single PrismaClient instance is reused across the process (and across
// hot-reloads in dev) to avoid exhausting the Postgres connection pool.

import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';
export { PrismaClient };

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
