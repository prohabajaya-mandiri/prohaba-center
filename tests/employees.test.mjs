import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { signedHeaders, verify, HEADERS } from "../src/lib/integration-signature.js";
import { SHARED, normalize } from "../scripts/check-hse-shared.mjs";

// Modul service memuat Prisma; tidak ada query yang dijalankan di tes ini.
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test?schema=test";

test("tanda tangan permintaan ke E-HSE terikat pada isi, URL dan pelaku", () => {
  const secret = "s".repeat(40), now = Date.UTC(2026, 9, 19);
  const path = "/api/integration/v1/personnel/abc/status";
  const body = Buffer.from(JSON.stringify({ workStatus: "CUTI" }));
  const h = signedHeaders(secret, { client: "center", method: "POST", path, body, actor: { id: "u1", name: "Rina", role: "HRD" }, now });
  const parts = { client: "center", timestamp: h[HEADERS.timestamp], method: "POST", path, body, actor: h[HEADERS.actor] };
  assert.equal(verify(secret, parts, h[HEADERS.signature], now), true);
  assert.equal(verify(secret, { ...parts, body: Buffer.from("{}") }, h[HEADERS.signature], now), false);
  assert.equal(verify(secret, { ...parts, path: path.replace("abc", "xyz") }, h[HEADERS.signature], now), false);
  assert.equal(verify(secret, parts, h[HEADERS.signature], now + 10 * 60 * 1000), false);
});

test("salinan lokal karyawan tidak memuat data sensitif dan mengikuti status E-HSE", async () => {
  const { mirrorData, canEditEmployees, requireEmployees } = await import("../src/lib/services/employees.js");
  const row = mirrorData({
    id: "p1", code: "PJM-000001", name: "Budi", nikLast4: "1234", category: "MANPOWER", position: "Tukang", siteCode: "TBG",
    siteName: "Tabang", workStatus: "RESIGN", isFormer: true, employmentType: "PKWT", contractEndDate: "2026-12-31T00:00:00.000Z",
    startDate: "2025-01-02T00:00:00.000Z", updatedAt: "2026-10-19T01:02:03.004Z", nikEnc: "v1:x", bankAccountEnc: "v1:y",
  });
  assert.equal(row.employeeNo, "PJM-000001");
  assert.equal(row.isActive, false);
  assert.equal(row.hseUpdatedAt.toISOString(), "2026-10-19T01:02:03.004Z");
  assert.ok(!Object.keys(row).some((k) => /nik$|Enc$|bankAccount|npwp|medical/i.test(k)));
  // NIP disalin bila ada di umpan (termasuk null = dihapus); umpan versi lama tanpa nip tidak menyentuhnya.
  assert.ok(!("nip" in row));
  assert.equal(mirrorData({ id: "p1", nip: "2019120212" }).nip, "2019120212");
  assert.equal(mirrorData({ id: "p1", nip: null }).nip, null);
  assert.equal(canEditEmployees({ role: "HRD" }), true);
  assert.equal(canEditEmployees({ role: "TOP_MANAGEMENT" }), false);
  assert.throws(() => requireEmployees({ role: "FINANCE" }), /tidak diizinkan/);
  assert.throws(() => requireEmployees({ role: "TOP_MANAGEMENT" }, true), /Hanya HRD/);
  assert.doesNotThrow(() => requireEmployees({ role: "TOP_MANAGEMENT" }));
});

test("master data umum tidak lagi dapat menulis karyawan", async () => {
  const { masterAllowed } = await import("../src/lib/services/master.js");
  assert.throws(() => masterAllowed("employees", { role: "HRD" }), /tidak diizinkan/);
  assert.doesNotThrow(() => masterAllowed("assignments", { role: "HRD" }));
});

test("berkas bersama identik dengan E-HSE (bila repo berdampingan)", { skip: !existsSync("../prohaba-hse/src/lib/domain/personnel.js") }, () => {
  for (const [from, to] of SHARED) assert.equal(normalize(readFileSync(to, "utf8")), normalize(readFileSync("../prohaba-hse/" + from, "utf8")), to);
});
