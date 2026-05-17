import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// Implement singleton pattern for PrismaClient to avoid exhausting database connections during dev hot-reloads.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

let prismaInstance: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  const adapter = new PrismaBetterSqlite3({ url: 'dev.db' });
  prismaInstance = new PrismaClient({ adapter });
} else {
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaBetterSqlite3({ url: 'dev.db' });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  prismaInstance = globalForPrisma.prisma;
}

export const prisma = prismaInstance;
