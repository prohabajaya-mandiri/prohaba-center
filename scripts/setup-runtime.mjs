import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
const production = process.argv[2] === "production",
  schema = production ? "public" : "prohaba_dev",
  role = production ? "prohaba_runtime" : "prohaba_runtime_dev",
  file = production
    ? ".env.runtime.production.local"
    : ".env.runtime.development.local";
const password = existsSync(file)
  ? new URL(readFileSync(file, "utf8").match(/DATABASE_URL="(.*)"/)[1]).password
  : randomBytes(36).toString("hex");
const quote = (v) => "'" + v.replaceAll("'", "''") + "'";
const token = process.env.SUPABASE_TOKEN;
if (!token) throw new Error("Management credential required");
let query =
  "BEGIN; DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname=" +
  quote(role) +
  ") THEN CREATE ROLE " +
  role +
  " LOGIN PASSWORD " +
  quote(password) +
  " NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF; END $$; ALTER ROLE " +
  role +
  " SET search_path TO " +
  schema +
  "; GRANT USAGE ON SCHEMA " +
  schema +
  " TO " +
  role +
  "; REVOKE CREATE ON SCHEMA " +
  schema +
  " FROM " +
  role +
  ";";
query += `DO $$ DECLARE t record; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname=${quote(schema)} AND tablename<>'_prisma_migrations' LOOP EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE %I.%I TO ${role}',${quote(schema)},t.tablename); EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',${quote(schema)},t.tablename); IF NOT EXISTS(SELECT FROM pg_policies WHERE schemaname=${quote(schema)} AND tablename=t.tablename AND policyname=${quote(role + "_access")}) THEN EXECUTE format('CREATE POLICY ${role}_access ON %I.%I TO ${role} USING (true) WITH CHECK (true)',${quote(schema)},t.tablename); END IF; END LOOP; END $$;`;
query +=
  "REVOKE UPDATE,DELETE ON " +
  schema +
  '."AuditLog",' +
  schema +
  '."JournalVoucherItem" FROM ' +
  role +
  "; COMMIT;";
const response = await fetch(
  "https://api.supabase.com/v1/projects/kdkoyvcdmwkrooywirzp/database/query",
  {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  },
);
if (!response.ok) {
  const details = await response.text();
  writeFileSync(".vercel/runtime-error.txt", details);
  throw new Error("Runtime role setup failed: " + response.status);
}
const url = new URL(process.env.DIRECT_URL);
url.username = role + ".kdkoyvcdmwkrooywirzp";
url.password = password;
url.port = '6543';
url.searchParams.set("schema", schema);
url.searchParams.delete("sslrootcert");
writeFileSync(file, 'DATABASE_URL="' + url.toString() + '"\n');
console.log("Restricted runtime role configured:", role, "schema:", schema);
