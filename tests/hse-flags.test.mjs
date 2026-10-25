import test from "node:test";
import assert from "node:assert/strict";
import { fieldHseNote, hseFlags } from "../src/lib/hse-flags.js";

const at = "2026-10-25T08:00:00.000Z";
const simper = (extra = {}) => ({ hseSiteId: "tbg", permitType: "SIMPER", startDate: "2026-01-01", endDate: "2026-12-31", revokedAt: null, ...extra });

test("MCU UNFIT dan kedaluwarsa ditandai; FIT, proses dan belum ada data tidak", () => {
  assert.deepEqual(hseFlags({ mcu: { result: "UNFIT", validUntil: "2027-01-01" }, at }), ["MCU_UNFIT"]);
  assert.deepEqual(hseFlags({ mcu: { result: "FIT", validUntil: "2026-10-24" }, at }), ["MCU_KEDALUWARSA"]);
  // Berlaku sampai akhir hari jatuh tempo.
  assert.deepEqual(hseFlags({ mcu: { result: "FIT", validUntil: "2026-10-25" }, at }), []);
  assert.deepEqual(hseFlags({ mcu: { result: "PENDING", validUntil: null }, at }), []);
  assert.deepEqual(hseFlags({ mcu: null, at }), []);
  assert.deepEqual(hseFlags({ mcu: undefined, at }), []);
});

test("SIMPER/KIMPER hanya diperiksa untuk unit yang wajib, di site yang sama", () => {
  assert.deepEqual(hseFlags({ mcu: null, permits: [], at }), []);
  assert.deepEqual(hseFlags({ mcu: null, permits: [], at, needsPermit: true }), ["SIMPER_TIDAK_BERLAKU"]);
  assert.deepEqual(hseFlags({ mcu: null, permits: [simper()], at, needsPermit: true, siteId: "tbg" }), []);
  assert.deepEqual(hseFlags({ mcu: null, permits: [simper({ permitType: "KIMPER" })], at, needsPermit: true, siteId: "tbg" }), []);
  assert.deepEqual(hseFlags({ mcu: null, permits: [simper()], at, needsPermit: true, siteId: "lht" }), ["SIMPER_TIDAK_BERLAKU"]);
  assert.deepEqual(hseFlags({ mcu: null, permits: [simper({ endDate: "2026-10-24" })], at, needsPermit: true }), ["SIMPER_TIDAK_BERLAKU"]);
  assert.deepEqual(hseFlags({ mcu: null, permits: [simper({ revokedAt: "2026-10-20T00:00:00Z" })], at, needsPermit: true }), ["SIMPER_TIDAK_BERLAKU"]);
  assert.deepEqual(hseFlags({ mcu: null, permits: [simper({ permitType: "ID Card / Mine Permit" })], at, needsPermit: true }), ["SIMPER_TIDAK_BERLAKU"]);
  // Data permit belum diterima dari E-HSE: tidak ditandai.
  assert.deepEqual(hseFlags({ mcu: null, permits: undefined, at, needsPermit: true }), []);
});

test("teks di HP lapangan tidak membedakan UNFIT dan kedaluwarsa", () => {
  assert.equal(fieldHseNote([]), null);
  assert.equal(fieldHseNote(["MCU_UNFIT", "SIMPER_TIDAK_BERLAKU"]), "Catatan HSE: MCU tidak berlaku, SIMPER/KIMPER tidak berlaku. Tetap tercatat dan dilaporkan.");
  assert.ok(!fieldHseNote(["MCU_UNFIT"]).includes("UNFIT"));
});
