import * as XLSX from "xlsx";
import { checkArchive } from "./boq-import.js";
import { ensure } from "./validation.js";
import { STANDARD_RATES, bookValue, findRegisterCodes } from "./assets.js";

// Membaca register aset dengan format yang sudah dipakai admin aset
// (LIST ASSET PJM 2026 Rev 1.xlsx): satu sheet per kategori, judul dua baris
// diawali sel "NO", data mulai dua baris di bawahnya. docs/inventaris-aset.md.

export const REGISTER_SHEETS = ["HSE", "BT", "MPK", "OF", "VEH"];
const MAX_ROWS = 5000;
const DAY = 86400000;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

const COLUMNS = {
  code: /^(kode|nomor registrasi)/,
  name: /^nama aset/,
  quantity: /^qty/,
  unit: /^uom/,
  brandSpec: /^merk/,
  identifier: /^plat/,
  depreciationClass: /^golongan/,
  depreciationRate: /^depresiasi \(%\)/,
  damaged: /^tahun rusak/,
  acquired: /^tahun perolehan/,
  unitPrice: /^harga satuan/,
  bookValue: /^nilai\s+sisa/,
  condition: /^kondisi/,
  location: /^lokasi/,
  notes: /^keterangan/,
};

const clean = (v) => (v == null ? null : String(v).replace(/\s+/g, " ").trim() || null);
const key = (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const fromSerial = (n) => new Date(EXCEL_EPOCH + Math.round(n) * DAY);

/** Tahun rusak: angka tahun, atau angka tahun yang terformat sebagai tanggal (serial 2026 = 18-07-1905). */
export function damagedYear(v) {
  if (typeof v !== "number") return null;
  if (v >= 1990 && v <= 2100) return v;
  const year = fromSerial(v).getUTCFullYear();
  return year >= 1990 && year <= 2100 ? year : null;
}

export function readRegisterWorkbook(buffer) {
  ensure(buffer.length >= 8, "File kosong/rusak.");
  checkArchive(buffer);
  const book = XLSX.read(buffer, {
    type: "buffer",
    sheets: REGISTER_SHEETS,
    sheetRows: MAX_ROWS,
    cellStyles: false,
    bookVBA: false,
  });
  const rows = [];
  let valueYear = null;
  for (const sheetName of REGISTER_SHEETS) {
    const sheet = book.Sheets[sheetName];
    if (!sheet) continue;
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
    const head = grid.findIndex((row) => clean(row[0])?.toUpperCase() === "NO");
    ensure(head >= 0, `Sheet ${sheetName}: judul kolom "NO" tidak ditemukan.`);
    const labels = grid[head].map((v, i) => [clean(v), clean(grid[head + 1]?.[i])]);
    const col = {};
    for (const [field, pattern] of Object.entries(COLUMNS)) {
      col[field] = labels.findIndex((pair) => pair.some((l) => l && pattern.test(l.toLowerCase())));
      ensure(col[field] >= 0, `Sheet ${sheetName}: kolom ${field} tidak ditemukan.`);
    }
    valueYear ??= Number(labels[col.bookValue].find((l) => l && /\d{4}/.test(l))?.match(/\d{4}/)[0]) || null;
    for (let i = head + 2; i < grid.length; i++) {
      const r = grid[i];
      const code = clean(r[col.code]);
      if (!code) continue;
      const num = (field) => (typeof r[col[field]] === "number" ? r[col[field]] : null);
      rows.push({
        sheet: sheetName,
        rowNumber: i + 1,
        code,
        name: clean(r[col.name]),
        quantity: num("quantity"),
        unit: clean(r[col.unit]),
        brandSpec: clean(r[col.brandSpec]),
        identifier: clean(r[col.identifier]),
        depreciationClass: clean(r[col.depreciationClass]),
        depreciationRate: num("depreciationRate"),
        damagedYear: damagedYear(r[col.damaged]),
        acquiredAt: num("acquired") == null ? null : fromSerial(num("acquired")),
        unitPrice: num("unitPrice"),
        excelBookValue: num("bookValue"),
        condition: clean(r[col.condition]),
        location: clean(r[col.location]),
        notes: clean(r[col.notes]),
      });
    }
  }
  ensure(rows.length > 0, "Tidak ada baris aset. Pastikan sheet HSE, BT, MPK, OF atau VEH ada.");
  return { rows, valueYear };
}

const CONDITIONS = { baik: "BAIK", perluperbaikan: "PERLU_PERBAIKAN", rusak: "RUSAK", hilang: "HILANG" };
// Penulisan lokasi yang berbeda di register lama.
const LOCATION_ALIASES = { vale: "valesorowako", sorowako: "valesorowako" };

/** Nomor register per unit dari isi sel KODE dan QTY. */
export function expandCodes(text, quantity) {
  const codes = findRegisterCodes(text);
  if (codes.length === 0) return { error: "Kode tidak sesuai pola PJM/KATEGORI/BULAN/TAHUN/NOMOR." };
  const asNumber = (c, seq) => `${c.prefix}/${String(seq).padStart(c.width, "0")}`;
  if (codes.length === 1) return { codes, units: [asNumber(codes[0], codes[0].seq)], lot: quantity > 1 };
  const [a, b] = codes;
  const span = b.seq - a.seq + 1;
  const isRange = codes.length === 2 && a.prefix === b.prefix && span > 1 && (/S\s*\/\s*D/i.test(text) || span === quantity);
  const units = isRange
    ? Array.from({ length: span }, (_, i) => asNumber(a, a.seq + i))
    : codes.map((c) => asNumber(c, c.seq));
  if (units.length !== quantity)
    return { codes, error: `${units.length} nomor register untuk QTY ${quantity}.` };
  return { codes, units, lot: false };
}

/**
 * Memeriksa baris register: baris dengan galat ditahan (tidak di-import), peringatan hanya info.
 * `locations`: [{ id, name }], `existing`: Set nomor register yang sudah ada di database.
 */
export function analyzeRegister(rows, { locations, valueYear, existing = new Set() }) {
  const locationByKey = new Map(locations.map((l) => [key(l.name), l]));
  const owners = new Map();
  const result = rows.map((row) => {
    const errors = [];
    const warnings = [];
    if (!row.name) errors.push("NAMA ASET kosong.");
    if (!(Number.isInteger(row.quantity) && row.quantity >= 1)) errors.push("QTY harus bilangan bulat ≥ 1.");
    const expanded = expandCodes(row.code, row.quantity);
    if (expanded.error) errors.push(expanded.error);
    if (expanded.codes?.some((c) => c.category !== row.sheet))
      errors.push(`Kategori di kode tidak sama dengan sheet ${row.sheet}.`);
    const units = expanded.error ? [] : expanded.units;
    for (const no of units) owners.set(no, [...(owners.get(no) ?? []), row]);

    if (!row.acquiredAt) errors.push("TAHUN PEROLEHAN kosong.");
    if (row.unitPrice == null) errors.push("HARGA SATUAN kosong.");
    const condition = CONDITIONS[key(row.condition)];
    if (!condition) errors.push(row.condition ? `KONDISI "${row.condition}" tidak dikenal.` : "KONDISI kosong.");
    const lk = key(row.location);
    const location = locationByKey.get(LOCATION_ALIASES[lk] ?? lk);
    if (!location) errors.push(row.location ? `LOKASI "${row.location}" belum ada di master lokasi.` : "LOKASI kosong.");
    if (row.depreciationClass && !(row.depreciationClass in STANDARD_RATES))
      errors.push(`Golongan "${row.depreciationClass}" tidak dikenal.`);

    const standard = STANDARD_RATES[row.depreciationClass];
    if (row.depreciationRate != null && standard != null && Math.abs(row.depreciationRate - standard) > 1e-9)
      warnings.push(`Tarif ${row.depreciationRate * 100} % tidak sama dengan ${row.depreciationClass} (${standard * 100} %).`);
    const first = expanded.codes?.[0];
    if (first && row.acquiredAt && (first.month !== row.acquiredAt.getUTCMonth() + 1 || first.year !== row.acquiredAt.getUTCFullYear()))
      warnings.push(`Bulan/tahun di kode berbeda dengan tanggal perolehan ${row.acquiredAt.toISOString().slice(0, 10)}.`);
    const quantity = expanded.lot ? row.quantity : 1;
    if (valueYear && row.excelBookValue != null && units.length) {
      const computed = bookValue({ ...row, quantity: row.quantity }, valueYear);
      if (computed != null && Math.abs(computed - row.excelBookValue) > 1)
        warnings.push(`Nilai sisa di Excel ${row.excelBookValue} berbeda dengan hitungan sistem ${computed}.`);
    }
    return { row, units, quantity, condition, location, errors, warnings };
  });

  // Nomor yang dipakai lebih dari satu baris: semua baris yang terlibat ditahan.
  const byRow = new Map(result.map((x) => [x.row, x]));
  const clashes = new Map();
  for (const rs of owners.values()) {
    if (rs.length < 2) continue;
    for (const r of rs)
      for (const o of rs) {
        if (o === r) continue;
        const counts = clashes.get(r) ?? new Map();
        const label = `${o.sheet} baris ${o.rowNumber} (${o.name ?? "tanpa nama"})`;
        counts.set(label, (counts.get(label) ?? 0) + 1);
        clashes.set(r, counts);
      }
  }
  for (const [r, counts] of clashes)
    for (const [label, n] of counts) byRow.get(r).errors.push(`${n} nomor register juga dipakai ${label}.`);

  // Nomor urut seharusnya unik per kategori; bulan/tahun berbeda membuat teks nomornya tetap unik, jadi hanya dicatat.
  const bySeq = new Map();
  for (const [no, rs] of owners) {
    const [c] = findRegisterCodes(no);
    const k = `${c.category}/${c.seq}`;
    bySeq.set(k, [...(bySeq.get(k) ?? []), ...rs.map((r) => [r, no])]);
  }
  for (const [k, list] of bySeq) {
    const rowsUsing = new Set(list.map(([r]) => r));
    if (rowsUsing.size < 2) continue;
    for (const r of rowsUsing) {
      const others = [...rowsUsing].filter((o) => o !== r).map((o) => `${o.sheet} baris ${o.rowNumber}`);
      byRow.get(r).warnings.push(`Nomor urut ${k.split("/")[1]} kategori ${k.split("/")[0]} juga dipakai ${others.join(", ")}.`);
    }
  }

  for (const item of result) {
    item.existing = item.units.filter((no) => existing.has(no)).length;
    item.status = item.errors.length ? "blocked" : item.existing === item.units.length ? "exists" : "ok";
  }
  return result;
}

export function summarize(result) {
  const sum = (items, f) => items.reduce((s, x) => s + f(x), 0);
  const ok = result.filter((x) => x.status === "ok");
  return {
    rows: result.length,
    okRows: ok.length,
    blockedRows: result.filter((x) => x.status === "blocked").length,
    existingRows: result.filter((x) => x.status === "exists").length,
    warningRows: result.filter((x) => x.warnings.length).length,
    newRegisters: sum(ok, (x) => x.units.length - x.existing),
    newUnits: sum(ok, (x) => (x.units.length === 1 ? x.quantity : x.units.length)),
  };
}
