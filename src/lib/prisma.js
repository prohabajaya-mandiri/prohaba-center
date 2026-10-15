import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { supabaseCa } from './supabase-ca.js';

const globalForPrisma = globalThis;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const url = new URL(connectionString);
  // pg URL SSL options override the explicit CA; keep filesystem paths CLI-only.
  url.searchParams.delete('sslrootcert');
  url.searchParams.delete('sslmode');
  const adapter = new PrismaPg({
    connectionString: url.toString(),
    ssl: { ca: supabaseCa, rejectUnauthorized: true },
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  }, { schema: url.searchParams.get('schema') ?? 'public' });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
