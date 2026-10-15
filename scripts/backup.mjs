import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { randomBytes, createCipheriv } from "node:crypto";
import pg from "pg";
const url = new URL(process.env.DIRECT_URL);
const schema = url.searchParams.get("schema") ?? "public";
if (!["public", "prohaba_dev"].includes(schema))
  throw new Error("Unexpected schema");
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const { rows: tables } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename",
    [schema],
  );
  const snapshot = { schema, createdAt: new Date().toISOString(), tables: [] };
  for (const { tablename } of tables) {
    const name = '"' + tablename.replaceAll('"', '""') + '"';
    const { rows } = await client.query(
      'SELECT row_to_json(t)::text AS row FROM "' + schema + '".' + name + " t",
    );
    snapshot.tables.push({ name: tablename, rows: rows.map((r) => r.row) });
  }
  await client.query("COMMIT");
  mkdirSync(".vercel/backups", { recursive: true });
  let key;
  if (existsSync(".env.backup.local"))
    key = Buffer.from(
      readFileSync(".env.backup.local", "utf8").match(
        /BACKUP_KEY="([a-f0-9]+)"/,
      )[1],
      "hex",
    );
  else {
    key = randomBytes(32);
    writeFileSync(
      ".env.backup.local",
      'BACKUP_KEY="' + key.toString("hex") + '"\n',
    );
  }
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(snapshot), "utf8"),
    cipher.final(),
  ]);
  const path = ".vercel/backups/" + schema + "-" + Date.now() + ".json.enc";
  writeFileSync(path, Buffer.concat([iv, cipher.getAuthTag(), encrypted]));
  writeFileSync(
    ".vercel/backups/latest-" + schema + ".json",
    JSON.stringify({
      path,
      tables: snapshot.tables.length,
      rows: snapshot.tables.reduce((s, t) => s + t.rows.length, 0),
    }),
  );
  console.log(
    "Encrypted backup saved:",
    path,
    "tables:",
    snapshot.tables.length,
    "rows:",
    snapshot.tables.reduce((s, t) => s + t.rows.length, 0),
  );
} finally {
  await client.end();
}
