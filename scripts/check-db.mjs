import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma.js';

try {
  const [connection] = await prisma.$queryRaw`SELECT current_user AS role`;
  const schema = new URL(process.env.DATABASE_URL).searchParams.get('schema') ?? 'public';
  assert.equal(connection.role, schema === 'prohaba_dev' ? 'prohaba_dev' : 'prohaba_app');
  const tables = await prisma.$queryRaw`
    SELECT relname, relrowsecurity FROM pg_class
    WHERE relnamespace = ${schema}::regnamespace AND relkind = 'r'
  `;
  assert.ok(tables.some((table) => table.relname === 'User'));
  assert.ok(tables.every((table) => table.relrowsecurity), 'Public tables must have RLS enabled');
  const users = await prisma.user.count();
  console.log(`Database connected: ${tables.length} tables protected by RLS; ${users} users.`);
} finally {
  await prisma.$disconnect();
}
