import { readFileSync, writeFileSync } from "node:fs";
import { createDecipheriv } from "node:crypto";
const schema = process.argv[2] ?? "public";
if (!["public", "prohaba_dev"].includes(schema))
  throw new Error("Unexpected schema");
const manifest = JSON.parse(
    readFileSync(".vercel/backups/latest-" + schema + ".json"),
  ),
  blob = readFileSync(manifest.path),
  key = Buffer.from(
    readFileSync(".env.backup.local", "utf8").match(
      /BACKUP_KEY="([a-f0-9]+)"/,
    )[1],
    "hex",
  ),
  decipher = createDecipheriv("aes-256-gcm", key, blob.subarray(0, 12));
decipher.setAuthTag(blob.subarray(12, 28));
const snapshot = JSON.parse(
  Buffer.concat([
    decipher.update(blob.subarray(28)),
    decipher.final(),
  ]).toString("utf8"),
);
const temp = "audit_restore_20261015",
  q = (v) => "'" + v.replaceAll("'", "''") + "'",
  id = (v) => '"' + v.replaceAll('"', '""') + '"';
let query = "BEGIN; CREATE SCHEMA " + temp + ";";
for (const table of snapshot.tables) {
  const target = temp + "." + id(table.name),
    original = id(schema) + "." + id(table.name);
  query += "CREATE TABLE " + target + " (LIKE " + original + " INCLUDING ALL);";
  for (const row of table.rows) {
    query +=
      "INSERT INTO " +
      target +
      " SELECT * FROM json_populate_record(NULL::" +
      target +
      "," +
      q(row) +
      ");";
    query += 'DO $$ BEGIN IF NOT EXISTS(SELECT FROM '+target+' restored WHERE to_jsonb(restored)='+q(row)+'::jsonb) THEN RAISE EXCEPTION '+q('Restore content mismatch')+'; END IF; END $$;';
  }
  query +=
    "DO $$ BEGIN IF (SELECT COUNT(*) FROM " +
    target +
    ") <> " +
    table.rows.length +
    " THEN RAISE EXCEPTION " +
    q("Restore mismatch") +
    "; END IF; END $$;";
}
query += "DROP SCHEMA " + temp + " CASCADE; COMMIT; SELECT true AS restored;";
const response = await fetch(
  "https://api.supabase.com/v1/projects/kdkoyvcdmwkrooywirzp/database/query",
  {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.SUPABASE_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  },
);
if (!response.ok) throw new Error("Restore drill failed: " + response.status);
const result = await response.json();
if (!result[0]?.restored) throw new Error("Restore unconfirmed");
writeFileSync(
  ".vercel/backups/restore-" + schema + ".json",
  JSON.stringify({
    verifiedAt: new Date().toISOString(),
    backup: manifest.path,
    tables: manifest.tables,
    rows: manifest.rows,
  }),
);
console.log(
  "Restore verified in isolated schema:",
  schema,
  manifest.tables,
  "tables",
  manifest.rows,
  "rows",
);
