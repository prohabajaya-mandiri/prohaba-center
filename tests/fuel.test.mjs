import test from "node:test";
import assert from "node:assert/strict";
import { consumption, countTolerance, fuelLedger, resolveEntryTime, usageStats } from "../src/lib/fuel.js";
import { FUEL_ROLE, canAccess, homePath, isFieldRole } from "../src/lib/access.js";

const at = (day, hour = 8) => new Date(Date.UTC(2026, 9, day, hour)).toISOString();

test("site stock follows receipts and issues, and resets at each stock count", () => {
  const ledger = fuelLedger({
    receipts: [{ at: at(1), liters: 2000 }, { at: at(10), liters: 1000 }],
    issues: [{ at: at(2), liters: 300 }, { at: at(3), liters: 200 }, { at: at(8), liters: 100 }],
    counts: [
      { id: "c1", at: at(5), totalLiters: 1490 }, // sistem 1500: kurang 10 L dari 500 L keluar → wajar
      { id: "c2", at: at(9), totalLiters: 1200 }, // sistem 1390: kurang 190 L → mencurigakan
    ],
  });
  assert.deepEqual(ledger.counts.map((c) => [c.system, c.variance, c.flagged]), [[1500, -10, false], [1390, -190, true]]);
  assert.equal(ledger.counts[1].issuedSince, 100);
  // Stok mengikuti hasil opname terakhir, bukan angka sistem sebelumnya.
  assert.equal(ledger.stock, 2200);
  assert.equal(ledger.lastCount.id, "c2");
});

test("issues recorded at the same moment as a count are included before the count", () => {
  const ledger = fuelLedger({ receipts: [{ at: at(1), liters: 400 }], issues: [{ at: at(2), liters: 100 }], counts: [{ id: "c", at: at(2), totalLiters: 300 }] });
  assert.equal(ledger.counts[0].variance, 0);
});

test("count tolerance is 2% of fuel issued with a 10 L floor", () => {
  assert.equal(countTolerance(0), 10);
  assert.equal(countTolerance(300), 10);
  assert.equal(countTolerance(2000), 40);
});

test("usage window and days of cover", () => {
  const now = new Date(at(20));
  const stats = usageStats([{ at: at(1), liters: 999 }, { at: at(10), liters: 700 }, { at: at(19), liters: 700 }], 1000, now);
  assert.equal(stats.usage, 1400);
  assert.equal(stats.perDay, 100);
  assert.equal(stats.daysCover, 10);
  assert.equal(usageStats([], 500, now).daysCover, null);
});

test("consumption flags a backward meter and a fill far above the unit's median", () => {
  const logs = [
    { id: "a", at: at(1), liters: 100, meterValue: 1000 },
    { id: "b", at: at(2), liters: 100, meterValue: 1010 },
    { id: "c", at: at(3), liters: 100, meterValue: 1020 },
    { id: "d", at: at(4), liters: 100, meterValue: 1030 },
    { id: "e", at: at(5), liters: 200, meterValue: 1040 }, // 20 L/HM vs median 10
    { id: "f", at: at(6), liters: 100, meterValue: 1035 }, // mundur
  ];
  const result = consumption(logs);
  assert.equal(result.median, 10);
  assert.deepEqual(result.flags.map((f) => [f.id, f.kind]).sort(), [["e", "HIGH_RATE"], ["f", "METER_BACKWARD"]]);
  // Genset tanpa HM memakai lama nyala.
  assert.equal(consumption([{ id: "g", at: at(1), liters: 30, runHours: 10 }]).rates[0].rate, 3);
});

test("offline fuel entries are corrected for a wrong phone clock and bounded to 7 days", () => {
  const now = new Date("2026-10-22T10:00:00Z");
  assert.equal(resolveEntryTime("2026-10-22T07:00:00Z", "2026-10-22T09:50:00Z", now).at.toISOString(), "2026-10-22T07:10:00.000Z");
  assert.equal(resolveEntryTime("2026-10-17T10:00:00Z", "2026-10-22T10:00:00Z", now).at.toISOString(), "2026-10-17T10:00:00.000Z");
  assert.match(resolveEntryTime("2026-10-14T10:00:00Z", "2026-10-22T10:00:00Z", now).error, /7 hari/);
  assert.match(resolveEntryTime("2026-10-22T10:05:00Z", "2026-10-22T10:00:00Z", now).error, /tidak valid/);
  assert.match(resolveEntryTime(undefined, "2026-10-22T10:00:00Z", now).error, /tidak valid/);
});

test("fuel officer accounts can only reach the fuel page; HO fuel actions are Logistik only", () => {
  assert.equal(homePath(FUEL_ROLE), "/bbm");
  assert.equal(isFieldRole(FUEL_ROLE), true);
  assert.equal(isFieldRole("LOGISTIK"), false);
  assert.equal(canAccess(FUEL_ROLE, "/bbm"), true);
  assert.equal(canAccess(FUEL_ROLE, "/api/bbm/sync", "POST"), true);
  for (const path of ["/dashboard", "/logistik", "/absen", "/api/logistik/bbm/shipments", "/api/absen/roster"]) assert.equal(canAccess(FUEL_ROLE, path), false, path);
  for (const role of ["TOP_MANAGEMENT", "LOGISTIK", "PJO", "ABSENSI"]) assert.equal(canAccess(role, "/api/bbm/sync", "POST"), false, role);
  for (const role of ["TOP_MANAGEMENT", "LOGISTIK"]) assert.equal(canAccess(role, "/api/logistik/bbm/shipments", "POST"), true, role);
  assert.equal(canAccess("PJO", "/api/logistik/bbm/shipments", "POST"), false);
  assert.equal(canAccess("PJO", "/api/logistik/bbm/issues/x/photo"), true);
  assert.equal(canAccess("PJO", "/api/logistik/fuel", "POST"), true);
});
