import test from "node:test";
import assert from "node:assert/strict";
import { signedHeaders } from "../src/lib/integration-signature.js";
import { attendanceDays, equipmentSummary, parseRange, unitServiceStatus } from "../src/lib/hse-operational.js";

process.env.HSE_INTEGRATION_SECRET = "s".repeat(40);
const { authenticateHse, hseIntegrationApi } = await import("../src/lib/hse-integration.js");

const url = "https://erp.example/api/integration/v1/hse/equipment?hseSiteId=tbg12345&from=2026-10-01&to=2026-10-31";
const req = ({ client = "hse", role = "HSE_SITE", secret = process.env.HSE_INTEGRATION_SECRET, path, method = "GET" } = {}) => {
  const u = new URL(url);
  const headers = signedHeaders(secret, { client, method, path: path ?? u.pathname + u.search, body: "", actor: { id: "u1", name: "Rina", role } });
  return new Request(url, { method, headers });
};

test("E-HSE → ERP: hanya klien hse bertanda tangan sah & peran HSE yang dapat membaca", () => {
  assert.equal(authenticateHse(req()).name, "Rina");
  assert.equal(authenticateHse(req({ client: "center" })), null, "tanda tangan arah ERP→E-HSE tidak berlaku di sini");
  assert.equal(authenticateHse(req({ secret: "x".repeat(40) })), null);
  assert.equal(authenticateHse(req({ role: "HRD" })), null, "peran di luar daftar pembaca ditolak");
  assert.equal(authenticateHse(req({ path: "/api/integration/v1/hse/equipment?hseSiteId=lain00000&from=2026-10-01&to=2026-10-31" })), null, "query diubah → ditolak");
});

test("route integrasi hanya GET dan menolak tanpa tanda tangan", async () => {
  const handler = hseIntegrationApi(async () => ({ ok: true }));
  assert.equal((await handler(new Request(url))).status, 401);
  assert.equal((await handler(req({ method: "POST" }))).status, 405);
  assert.equal((await handler(req())).status, 200);
});

test("rentang tanggal dibatasi", () => {
  const p = (from, to) => new URLSearchParams({ from, to });
  assert.ok(parseRange(p("2026-10-01", "2026-10-31"), 62));
  assert.equal(parseRange(p("2026-10-31", "2026-10-01"), 62), null);
  assert.equal(parseRange(p("2026-01-01", "2026-10-31"), 62), null);
  assert.equal(parseRange(p("2026-10-1", "2026-10-31"), 62), null);
});

test("status servis unit: terlambat, mendekati, terjadwal, tanpa jadwal", () => {
  const range = { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-10-31T00:00:00Z"), asOf: new Date("2026-10-29T00:00:00Z") };
  const log = (date, next, type = "SERVICE") => ({ date: new Date(date), type, nextServiceDate: next ? new Date(next) : null, nextServiceMeter: null });
  assert.equal(unitServiceStatus([log("2026-09-01", "2026-10-20")], range).due, "TERLAMBAT");
  assert.equal(unitServiceStatus([log("2026-10-05", "2026-11-05")], range).due, "MENDEKATI");
  assert.equal(unitServiceStatus([log("2026-10-05", "2026-12-30")], range).due, "TERJADWAL");
  assert.equal(unitServiceStatus([], range).due, "TANPA_JADWAL");
  const s = unitServiceStatus([log("2026-10-20", null, "GANTI_OLI"), log("2026-10-05", "2026-12-30")], range);
  assert.equal(s.servicesInPeriod, 2);
  assert.equal(s.nextServiceDate.toISOString().slice(0, 10), "2026-12-30", "jadwal dari catatan terbaru yang memilikinya");
  const sum = equipmentSummary([{ type: "ALAT_BERAT", service: { due: "TERLAMBAT", servicesInPeriod: 1 } }, { type: "KENDARAAN", service: { due: "TERJADWAL", servicesInPeriod: 0 } }]);
  assert.deepEqual(sum, { units: 2, byType: { ALAT_BERAT: 1, KENDARAAN: 1 }, byDue: { TERLAMBAT: 1, TERJADWAL: 1 }, servicesInPeriod: 1 });
});

test("rekap absensi harian: hadir hanya status HADIR", () => {
  const d = attendanceDays([
    { date: "2026-10-01T00:00:00Z", status: "HADIR", count: 40, overtime: 12 },
    { date: "2026-10-01T00:00:00Z", status: "SAKIT", count: 2, overtime: 0 },
    { date: "2026-10-02T00:00:00Z", status: "HADIR", count: 38, overtime: 0 },
  ]);
  assert.deepEqual(d, [{ date: "2026-10-01", present: 40, recorded: 42, overtimeHours: 12 }, { date: "2026-10-02", present: 38, recorded: 38, overtimeHours: 0 }]);
});
