import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { averageCost, locationCode, normalizeUnit, weekRange, weeklyReport } from "../src/lib/stock.js";
import { analyzeOpname, groupFor, readOpnameWorkbook } from "../src/lib/stock-import.js";
import { canAccess } from "../src/lib/access.js";

test("units from the old report are standardised", () => {
  assert.deepEqual(normalizeUnit("Bh"), { unit: "bh", decimals: false });
  assert.deepEqual(normalizeUnit("unit "), { unit: "unit", decimals: false });
  assert.deepEqual(normalizeUnit("m'"), { unit: "m", decimals: true });
  assert.deepEqual(normalizeUnit("Klg"), { unit: "klg", decimals: false });
  assert.equal(normalizeUnit("zak?"), null);
});

test("location codes follow bay, level, bin and floor zones", () => {
  assert.equal(locationCode({ type: "RAK", bay: 1, level: 3 }), "HO-R1-T3");
  assert.equal(locationCode({ type: "BIN", bay: 2, level: 1, bin: 4 }), "HO-R2-T1-B04");
  assert.equal(locationCode({ type: "LANTAI", zone: 2 }), "HO-LT-02");
});

test("moving average changes only on receipts", () => {
  const card = [
    { type: "SALDO_AWAL", qty: 10, unitCost: 100 },
    { type: "KELUAR", qty: -4, unitCost: 100 },
    { type: "MASUK", qty: 6, unitCost: 160 }, // (6 × 100 + 6 × 160) / 12 = 130
    { type: "RETUR", qty: 2, unitCost: 130 },
    { type: "PINDAH", qty: -3, unitCost: 130 },
    { type: "PINDAH", qty: 3, unitCost: 130 },
  ];
  assert.deepEqual(averageCost(card), { qty: 14, avgCost: 130 });
  // Stok habis lalu masuk lagi: rata-rata mulai dari harga baru.
  assert.deepEqual(averageCost([{ type: "MASUK", qty: 2, unitCost: 50 }, { type: "KELUAR", qty: -2, unitCost: 50 }, { type: "MASUK", qty: 1, unitCost: 80 }]), { qty: 1, avgCost: 80 });
});

test("weekly report keeps the old Excel layout and ignores location moves", () => {
  const { start, end } = weekRange("2026-10-07"); // Rabu → Senin 5 Okt s/d Senin 12 Okt
  assert.equal(start.toISOString().slice(0, 10), "2026-10-05");
  assert.equal(end.toISOString().slice(0, 10), "2026-10-12");
  const rows = weeklyReport(
    [{ id: "a", avgCost: 1000 }],
    [
      { itemId: "a", qty: 20, type: "SALDO_AWAL", docDate: "2026-09-30" },
      { itemId: "a", qty: -5, type: "KELUAR", docDate: "2026-10-01" },
      { itemId: "a", qty: 8, type: "MASUK", docDate: "2026-10-06" },
      { itemId: "a", qty: -3, type: "KELUAR", docDate: "2026-10-09" },
      { itemId: "a", qty: -2, type: "PINDAH", docDate: "2026-10-09" },
      { itemId: "a", qty: 2, type: "PINDAH", docDate: "2026-10-09" },
      { itemId: "a", qty: -1, type: "KELUAR", docDate: "2026-10-12" }, // minggu berikutnya
    ],
    { start, end },
  );
  assert.deepEqual(
    { opening: rows[0].opening, inQty: rows[0].inQty, outQty: rows[0].outQty, closing: rows[0].closing, value: rows[0].value },
    { opening: 15, inQty: 8, outQty: 3, closing: 20, value: 20000 },
  );
});

test("opening balance counts as last week's stock even in the opname week", () => {
  const range = weekRange("2026-10-01"); // Senin 28 Sep – Minggu 4 Okt, saldo awal 30 Sep
  const [row] = weeklyReport(
    [{ id: "a", avgCost: 10 }],
    [{ itemId: "a", qty: 100, type: "SALDO_AWAL", docDate: "2026-09-30" }, { itemId: "a", qty: -10, type: "KELUAR", docDate: "2026-10-02" }],
    range,
  );
  assert.deepEqual([row.opening, row.inQty, row.outQty, row.closing], [100, 0, 10, 90]);
});

test("opname sections map to item groups; paint and chemicals are split out", () => {
  assert.equal(groupFor("A. ACCESORIES SANITAIR", "Kloset"), "SAN");
  assert.equal(groupFor("ACCESSORIES PIPA PPR", "Sock"), "PPR");
  assert.equal(groupFor("Accessories Pintu Dan Jendela", "Engsel"), "PJD");
  assert.equal(groupFor("ACCESSORIES PIPA PLUMBING DAN HYDRANT", "Gate Valve"), "PLB");
  assert.equal(groupFor("CAT dan Lain-Lain", "Cairan Sikatop 107"), "KIM");
  assert.equal(groupFor("CAT dan Lain-Lain", "Geogrid 30KN"), "UMM");
});

function opnameBook(rows) {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["LIST STOK MATERIAL GUDANG KANTOR"],
    ["No.", "Nama Bahan", "Sat", "Volume", null, "Mutasi", "Total Volume", "Harga Satuan", "Jumlah", "Keterangan"],
    [null, null, null, "Minggu Lalu", "Minggu ini"],
    ...rows,
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "30-Sept-2026");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}

test("reads the opname sheet and merges duplicate names", () => {
  const { rows } = readOpnameWorkbook(
    opnameBook([
      ["A.", "ACCESORIES SANITAIR", null, null, null, null, 0],
      [1, "Kloset Jongkok", "Unit", 1, null, null, 1, 1840000, 1840000],
      [2, "Hand Shower Onda", "bh", 7, null, 2, 5, 185000, 925000, "Mutasi Tabang"],
      ["E", "ACCESSORIES PIPA PLUMBING DAN HYDRANT", null, null, null, null, 0],
      [1, 'Gate Valve 3" Ex. Kitz', "bh", 1, null, null, 1, 4000000, 4000000],
      [2, 'Gate Valve 3" ex Kitz', "Bh", 3, null, null, 3, null, 0],
      [3, "Pipa PVC 1/2", "m'", 12.5, null, null, 12.5, 10000, 125000],
      [4, "Valve rusak", "bh", 0, null, null, 0, 0, 0],
      [5, "Barang aneh", "zak", 2, null, null, 2, 1, 2],
      [null, "JUMLAH TOTAL", null, null, null, null, null, null, 6890002],
    ]),
  );
  assert.equal(rows.length, 7);
  const { items, blocked, summary } = analyzeOpname(rows);
  assert.deepEqual(blocked.map((b) => [b.name, b.errors[0]]), [["Barang aneh", 'Satuan "zak" tidak dikenal.']]);
  const gate = items.find((i) => i.name.startsWith("Gate Valve"));
  assert.deepEqual([gate.group, gate.qty, gate.price, gate.rows], ["PLB", 4, 1000000, [8, 9]]);
  assert.equal(items.find((i) => i.name === "Pipa PVC 1/2").unit, "m");
  assert.equal(items.find((i) => i.name === "Hand Shower Onda").notes, "Mutasi Tabang");
  assert.deepEqual(summary, { rows: 7, items: 5, blocked: 1, merged: 1, withStock: 4, noPrice: 1, value: 6890000 });
});

test("only logistics and top management move stock; finance and PJO read", () => {
  for (const role of ["TOP_MANAGEMENT", "LOGISTIK", "FINANCE", "PJO"]) assert.ok(canAccess(role, "/gudang"));
  assert.ok(!canAccess("HRD", "/gudang"));
  assert.ok(canAccess("LOGISTIK", "/api/gudang/documents", "POST"));
  assert.ok(!canAccess("FINANCE", "/api/gudang/documents", "POST"));
  assert.ok(!canAccess("PJO", "/api/gudang/documents", "POST"));
});
