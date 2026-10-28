import test from "node:test";
import assert from "node:assert/strict";
import { encodeAttendanceQr, decodeAttendanceQr } from "../src/lib/attendance-qr.js";
import { employeeTag, localDate, localTime, resolveScanTime } from "../src/lib/attendance-scan.js";
import { canAccess, homePath, KIOSK_ROLE } from "../src/lib/access.js";

test("attendance QR is signed and rejects forged or altered codes", () => {
  process.env.ATTENDANCE_QR_SECRET = "x".repeat(40);
  const code = encodeAttendanceQr("PJM-000123");
  assert.match(code, /^PRHB1\.PJM-000123\.[A-Za-z0-9_-]{12}$/);
  assert.equal(decodeAttendanceQr(code), "PJM-000123");
  assert.equal(decodeAttendanceQr(` ${code}\n`), "PJM-000123");
  assert.equal(decodeAttendanceQr(code.replace("000123", "000124")), null);
  assert.equal(decodeAttendanceQr("PJM-000123"), null);
  assert.equal(decodeAttendanceQr(code.slice(0, -1) + (code.endsWith("A") ? "B" : "A")), null);
  process.env.ATTENDANCE_QR_SECRET = "y".repeat(40);
  assert.equal(decodeAttendanceQr(code), null);
  delete process.env.ATTENDANCE_QR_SECRET;
  assert.throws(() => encodeAttendanceQr("PJM-000123"), /ATTENDANCE_QR_SECRET/);
});

test("scan date follows the site time zone, not UTC", () => {
  const at = new Date("2026-10-21T17:30:00Z");
  assert.equal(localDate(at, "Asia/Jakarta"), "2026-10-22");
  assert.equal(localTime(at, "Asia/Jakarta"), "00:30");
  assert.equal(localDate(new Date("2026-10-21T15:30:00Z"), "Asia/Jakarta"), "2026-10-21");
  assert.equal(localTime(at, "Asia/Jayapura"), "02:30");
});

test("field PIC accounts can only reach the attendance page", () => {
  assert.equal(homePath(KIOSK_ROLE), "/absen");
  assert.equal(homePath("HRD"), "/dashboard");
  assert.equal(canAccess(KIOSK_ROLE, "/absen"), true);
  assert.equal(canAccess(KIOSK_ROLE, "/api/absen/sync", "POST"), true);
  for (const path of ["/dashboard", "/projects", "/hr", "/payroll", "/api/hr/attendance"]) assert.equal(canAccess(KIOSK_ROLE, path), false, path);
  for (const role of ["TOP_MANAGEMENT", "HRD", "PJO"]) assert.equal(canAccess(role, "/api/absen/sync", "POST"), true);
  for (const role of ["FINANCE", "LOGISTIK", "ENGINEERING", "WORKSHOP"]) assert.equal(canAccess(role, "/absen"), false);
});

test("offline scan time is corrected for a wrong phone clock and bounded", () => {
  const now = new Date("2026-10-22T10:00:00Z");
  // HP 10 menit terlambat: scan 07:00 jam HP, dikirim 09:50 jam HP = 07:10 jam server.
  assert.equal(resolveScanTime("2026-10-22T07:00:00Z", "2026-10-22T09:50:00Z", now).at.toISOString(), "2026-10-22T07:10:00.000Z");
  assert.equal(resolveScanTime("2026-10-22T10:00:00Z", "2026-10-22T10:00:00Z", now).at.toISOString(), now.toISOString());
  assert.match(resolveScanTime("2026-10-22T10:05:00Z", "2026-10-22T10:00:00Z", now).error, /tidak valid/);
  assert.match(resolveScanTime("2026-10-18T10:00:00Z", "2026-10-22T10:00:00Z", now).error, /3 hari/);
  assert.match(resolveScanTime("bukan-tanggal", "2026-10-22T10:00:00Z", now).error, /tidak valid/);
  assert.match(resolveScanTime(undefined, "2026-10-22T10:00:00Z", now).error, /tidak valid/);
});

test("attendance card shows NIP when present, otherwise the employee category", () => {
  assert.equal(employeeTag({ nip: "2024001", category: "STAFF" }), "NIP 2024001");
  assert.equal(employeeTag({ nip: null, category: "HARIAN_KANTOR" }), "Harian Kantor");
  assert.equal(employeeTag({ nip: "", category: "MANPOWER" }), "Manpower");
  assert.equal(employeeTag({ nip: null, category: null }), null);
});
