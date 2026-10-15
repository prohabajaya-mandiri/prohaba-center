import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma.js';

try {
  const [connection] = await prisma.$queryRaw`SELECT current_user AS role`;
  const schema = new URL(process.env.DATABASE_URL).searchParams.get('schema') ?? 'public';
  assert.equal(connection.role, schema === 'prohaba_dev' ? 'prohaba_runtime_dev' : 'prohaba_runtime');
  const [privilege] = await prisma.$queryRaw`SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user`;
  assert.ok(Object.values(privilege).every(value=>value===false),'Runtime must not have privileged capabilities');
  const [ownership] = await prisma.$queryRaw`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname=${schema} AND tableowner=current_user`;
  assert.equal(ownership.count,0,'Runtime must not own tables');
  const [audit] = await prisma.$queryRaw`SELECT has_table_privilege(current_user,${schema+'."AuditLog"'},'DELETE') AS delete,has_table_privilege(current_user,${schema+'."AuditLog"'},'UPDATE') AS update,has_schema_privilege(current_user,${schema},'CREATE') AS create`;
  assert.equal(audit.delete,false);assert.equal(audit.update,false);assert.equal(audit.create,false);
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
