import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { bookValue, findRegisterCodes, registerNumber } from "../src/lib/assets.js";
import { analyzeRegister, damagedYear, expandCodes, readRegisterWorkbook, summarize } from "../src/lib/asset-import.js";
import { canAccess } from "../src/lib/access.js";

const LOCATIONS = [{ id: "ho", name: "HO" }, { id: "vale", name: "Vale/Sorowako" }, { id: "kat", name: "Kasongan / Katingan" }];
const row = (over = {}) => ({
  sheet: "MPK",
  rowNumber: 12,
  code: "PJM/MPK/VIII/24/0001",
  name: "GENSET",
  quantity: 1,
  depreciationClass: "Gol 1",
  depreciationRate: 0.25,
  acquiredAt: new Date(Date.UTC(2024, 7, 6)),
  unitPrice: 1000,
  excelBookValue: null,
  condition: "BAIK",
  location: "HO",
  ...over,
});

test("register numbers follow PJM/category/Roman month/YY/sequence", () => {
  assert.equal(registerNumber("MPK", "2025-12-03", 85), "PJM/MPK/XII/25/0085");
  assert.equal(registerNumber("VEH", "2024-02-01", 2, 3), "PJM/VEH/II/24/002");
  assert.equal(registerNumber("MPK", "2024-09-01", 10405), "PJM/MPK/IX/24/10405");
  const [code] = findRegisterCodes("pjm/hse/ix/24/0001 ");
  assert.deepEqual([code.category, code.month, code.year, code.seq, code.width], ["HSE", 9, 2024, 1, 4]);
});

test("a code cell expands to one register number per unit", () => {
  assert.deepEqual(expandCodes("PJM/OF/VIII/24/0001", 1).units, ["PJM/OF/VIII/24/0001"]);
  // Rentang "S/D", juga melewati 4 → 5 digit.
  const range = expandCodes("PJM/MPK/IX/24/9998    S/D     PJM/MPK/IX/24/10001", 4);
  assert.deepEqual(range.units, ["PJM/MPK/IX/24/9998", "PJM/MPK/IX/24/9999", "PJM/MPK/IX/24/10000", "PJM/MPK/IX/24/10001"]);
  // Dua nomor tanpa "S/D" adalah rentang bila jumlahnya sama dengan QTY…
  assert.equal(expandCodes("PJM/MPK/XII/25/0085   PJM/MPK/XII/25/0094", 10).units.length, 10);
  // …dan dua nomor terpisah bila QTY = 2.
  assert.deepEqual(expandCodes("PJM/HSE/VI/26/0018   PJM/HSE/VI/26/0020", 2).units, ["PJM/HSE/VI/26/0018", "PJM/HSE/VI/26/0020"]);
  // Satu nomor untuk banyak unit = satu aset dengan jumlah.
  assert.deepEqual(expandCodes("PJM/MPK/I/23/0001", 1441), { codes: findRegisterCodes("PJM/MPK/I/23/0001"), units: ["PJM/MPK/I/23/0001"], lot: true });
  assert.match(expandCodes("PJM/MPK/I/23/3435 S/D PJM/MPK/I/23/3459", 272).error, /25 nomor register untuk QTY 272/);
  assert.match(expandCodes("PJM/OF/VII/0339", 1).error, /pola/);
});

test("damaged year accepts plain years and years typed into date cells", () => {
  assert.equal(damagedYear(2026), 2026);
  assert.equal(damagedYear(2026.0), 2026);
  assert.equal(damagedYear(46143), 2026); // tanggal 1-5-2026
  assert.equal(damagedYear(null), null);
  assert.equal(damagedYear(12), null);
});

test("book value is straight line from the year after acquisition and never negative", () => {
  const asset = { unitPrice: 750000, quantity: 1, depreciationRate: 0.25, acquiredAt: "2024-09-01" };
  assert.equal(bookValue(asset, 2024), 750000);
  assert.equal(bookValue(asset, 2026), 375000);
  assert.equal(bookValue(asset, 2030), 0);
  assert.equal(bookValue({ ...asset, quantity: 4 }, 2025), 2250000);
  assert.equal(bookValue({ ...asset, unitPrice: null }, 2026), null);
});

test("import blocks bad rows and only flags oddities", () => {
  const result = analyzeRegister(
    [
      row(),
      row({ rowNumber: 13, code: "PJM/MPK/VIII/24/0002", location: "Vale", condition: "Baik", depreciationRate: 0.125 }),
      row({ rowNumber: 14, code: "PJM/MPK/VIII/24/0003", condition: null }),
      row({ rowNumber: 15, code: "PJM/MPK/VIII/24/0004", location: "Lahat" }),
      row({ rowNumber: 16, code: "PJM/MPK/IX/25/0005", unitPrice: 4000, excelBookValue: 1 }),
    ],
    { locations: LOCATIONS, valueYear: 2026 },
  );
  assert.deepEqual(result.map((x) => x.status), ["ok", "ok", "blocked", "blocked", "ok"]);
  assert.equal(result[1].location.id, "vale");
  assert.match(result[1].warnings[0], /Tarif 12.5 % tidak sama dengan Gol 1/);
  assert.match(result[2].errors[0], /KONDISI kosong/);
  assert.match(result[3].errors[0], /LOKASI "Lahat" belum ada/);
  assert.ok(result[4].warnings.some((w) => /Bulan\/tahun di kode/.test(w)));
  assert.ok(result[4].warnings.some((w) => /Nilai sisa di Excel 1 berbeda dengan hitungan sistem 2000/.test(w)));
});

test("a register number used by two rows holds both rows", () => {
  const result = analyzeRegister(
    [
      row({ code: "PJM/MPK/VIII/24/0010 S/D PJM/MPK/VIII/24/0012", quantity: 3, name: "TANGGA" }),
      row({ rowNumber: 20, code: "PJM/MPK/VIII/24/0012 S/D PJM/MPK/VIII/24/0013", quantity: 2, name: "FRAME" }),
      row({ rowNumber: 21, code: "PJM/MPK/VIII/24/0014" }),
    ],
    { locations: LOCATIONS, valueYear: 2026 },
  );
  assert.deepEqual(result.map((x) => x.status), ["blocked", "blocked", "ok"]);
  assert.equal(result[0].errors[0], "1 nomor register juga dipakai MPK baris 20 (FRAME).");
});

test("the same sequence under a different month is only flagged", () => {
  const result = analyzeRegister(
    [row({ code: "PJM/MPK/IX/24/0143" }), row({ rowNumber: 13, code: "PJM/MPK/VII/24/0143" })],
    { locations: LOCATIONS },
  );
  assert.deepEqual(result.map((x) => x.status), ["ok", "ok"]);
  assert.ok(result[0].warnings.includes("Nomor urut 143 kategori MPK juga dipakai MPK baris 13."));
});

test("rows already in the database are skipped on re-import", () => {
  const rows = [row(), row({ rowNumber: 13, code: "PJM/MPK/VIII/24/0002 S/D PJM/MPK/VIII/24/0003", quantity: 2 })];
  const result = analyzeRegister(rows, { locations: LOCATIONS, existing: new Set(["PJM/MPK/VIII/24/0001", "PJM/MPK/VIII/24/0002"]) });
  assert.deepEqual(result.map((x) => [x.status, x.existing]), [["exists", 1], ["ok", 1]]);
  assert.deepEqual(summarize(result), { rows: 2, okRows: 1, blockedRows: 0, existingRows: 1, warningRows: 0, newRegisters: 1, newUnits: 2 });
});

test("reads the register layout used by the asset admin", () => {
  const head = [
    ["NO", "KODE ", "JENIS ASET", "NAMA ASET", "QTY", "UOM", "DETIL SPESIFIKASI", null, "Golongan Depresiasi", "Depresiasi (%)", "TAHUN RUSAK", "TAHUN PEROLEHAN", "HARGA", null, null, null, "KONDISI ", "LOKASI ", "KETERANGAN"],
    [null, null, null, null, null, null, "MERK & SPESIFIKASI", "PLAT NO / SN / PN", null, null, null, null, "HARGA SATUAN", "TOTAL HARGA", "DEPRESIASI PER TAHUN", "NILAI  SISA PER AKHIR 2026", null, null, null],
  ];
  const data = [1, "PJM/VEH/II/24/002", "Kendaraan", "MITSUBISHI TRITON", 1, null, "MITSUBISHI", "KT 8994 YW", "Gol 2", 0.125, 2025, 45323, 416625000, 416625000, 52078125, 312468750, "BAIK", "Kasongan/Katingan", "Fahmi"];
  const sheet = XLSX.utils.aoa_to_sheet([["TAHUN ANGGARAN 2026 (KENDARAAN)"], [], ...head, [], data]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "VEH");
  const { rows, valueYear } = readRegisterWorkbook(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
  assert.equal(valueYear, 2026);
  assert.equal(rows.length, 1);
  assert.deepEqual(
    { ...rows[0], acquiredAt: rows[0].acquiredAt.toISOString().slice(0, 10) },
    {
      sheet: "VEH", rowNumber: 6, code: "PJM/VEH/II/24/002", name: "MITSUBISHI TRITON", quantity: 1, unit: null,
      brandSpec: "MITSUBISHI", identifier: "KT 8994 YW", depreciationClass: "Gol 2", depreciationRate: 0.125,
      damagedYear: 2025, acquiredAt: "2024-02-01", unitPrice: 416625000, excelBookValue: 312468750,
      condition: "BAIK", location: "Kasongan/Katingan", notes: "Fahmi",
    },
  );
  const [item] = analyzeRegister(rows, { locations: LOCATIONS, valueYear });
  assert.deepEqual([item.status, item.location.id, item.warnings], ["ok", "kat", []]);
});

test("only asset admins change the register; finance and PJO can read", () => {
  for (const role of ["TOP_MANAGEMENT", "LOGISTIK", "FINANCE", "PJO"]) assert.ok(canAccess(role, "/inventaris"));
  assert.ok(!canAccess("HRD", "/inventaris"));
  assert.ok(canAccess("LOGISTIK", "/api/inventaris/import", "POST"));
  assert.ok(!canAccess("FINANCE", "/api/inventaris/import", "POST"));
  assert.ok(!canAccess("PJO", "/api/inventaris/import", "POST"));
});
