import * as XLSX from "xlsx";
import { checkArchive } from "./boq-import.js";
import { ensure } from "./validation.js";
import { normalizeUnit } from "./stock.js";

// Membaca laporan opname gudang HO format Excel lama ("LIST STOK MATERIAL GUDANG KANTOR"):
// baris kelompok (A. ACCESORIES SANITAIR, …) diikuti baris barang; stok akhir di kolom Total Volume.
// Hasilnya menjadi master barang + satu dokumen SALDO_AWAL. docs/gudang-ho.md

const MAX_ROWS = 3000;

const GROUP_RULES = [
  [/sanit/i, "SAN"],
  [/ppr/i, "PPR"],
  [/pvc/i, "PVC"],
  [/pintu|jendela/i, "PJD"],
  [/electric|elektrik|listrik/i, "ELC"],
  [/plumbing|hydrant/i, "PLB"],
  [/apd|safety/i, "APD"],
  [/cat|lain/i, "UMM"],
];
// Bahan kimia & cat di kelompok "CAT dan Lain-Lain" dipisah ke KIM.
const CHEMICAL = /\b(cat|sika\w*|propan|penetran|thinner|remover|lem|cairan|epoxy|sealant)\b/i;

const clean = (v) => (v == null ? null : String(v).replace(/\s+/g, " ").trim() || null);
export const nameKey = (name) => String(name).toLowerCase().replace(/[\s.]+/g, " ").trim();

export function groupFor(section, name) {
  const group = GROUP_RULES.find(([re]) => re.test(section ?? ""))?.[1] ?? null;
  if (group === "UMM" && CHEMICAL.test(name)) return "KIM";
  return group;
}

export function readOpnameWorkbook(buffer) {
  ensure(buffer.length >= 8, "File kosong/rusak.");
  checkArchive(buffer);
  const book = XLSX.read(buffer, { type: "buffer", sheetRows: MAX_ROWS, cellStyles: false, bookVBA: false });
  for (const sheetName of book.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, defval: null, raw: true });
    const head = grid.findIndex((row) => row.some((v) => /^nama (bahan|barang)/i.test(clean(v) ?? "")));
    if (head < 0) continue;
    const labels = grid[head].map((v, i) => `${clean(v) ?? ""} ${clean(grid[head + 1]?.[i]) ?? ""}`.toLowerCase());
    const col = (re) => labels.findIndex((l) => re.test(l));
    const c = { name: col(/nama/), unit: col(/^sat/), total: col(/total volume|stok akhir/), price: col(/harga/), notes: col(/keterangan/) };
    ensure(c.name >= 0 && c.unit >= 0 && c.total >= 0, `Sheet ${sheetName}: kolom Nama, Sat dan Total Volume harus ada.`);
    const rows = [];
    let section = null;
    for (let i = head + 2; i < grid.length; i++) {
      const r = grid[i];
      const name = clean(r[c.name]);
      if (!name || /^jumlah/i.test(name)) continue;
      const unit = clean(r[c.unit]);
      const total = r[c.total];
      // Baris kelompok: ada nama, tanpa satuan dan tanpa jumlah.
      if (!unit && !total) {
        section = name;
        continue;
      }
      rows.push({
        rowNumber: i + 1,
        section,
        name,
        unit,
        qty: typeof total === "number" ? total : null,
        price: typeof r[c.price] === "number" ? r[c.price] : null,
        notes: c.notes >= 0 ? clean(r[c.notes]) : null,
      });
    }
    ensure(rows.length > 0, `Sheet ${sheetName}: tidak ada baris barang.`);
    return { sheetName, rows };
  }
  ensure(false, 'Judul kolom "Nama Bahan" tidak ditemukan di sheet mana pun.');
}

/**
 * Menyiapkan master barang dari baris opname: satuan dibakukan, nama dobel (nama + satuan sama)
 * digabung dengan harga rata-rata tertimbang. Baris dengan galat ditahan.
 */
export function analyzeOpname(rows) {
  const items = new Map();
  const blocked = [];
  for (const row of rows) {
    const errors = [];
    const unit = normalizeUnit(row.unit);
    if (!unit) errors.push(`Satuan "${row.unit ?? ""}" tidak dikenal.`);
    const group = groupFor(row.section, row.name);
    if (!group) errors.push(`Kelompok "${row.section ?? "-"}" tidak dikenal.`);
    if (row.qty == null) errors.push("Total Volume kosong.");
    else if (row.qty < 0) errors.push("Total Volume minus.");
    else if (unit && !unit.decimals && !Number.isInteger(row.qty)) errors.push(`Jumlah ${row.qty} harus bulat untuk satuan ${unit.unit}.`);
    if (errors.length) {
      blocked.push({ ...row, errors });
      continue;
    }
    const key = `${nameKey(row.name)}|${unit.unit}`;
    const existing = items.get(key);
    if (existing) {
      const value = existing.qty * existing.price + row.qty * (row.price ?? 0);
      existing.qty += row.qty;
      existing.price = existing.qty ? Math.round((value / existing.qty) * 100) / 100 : Math.max(existing.price, row.price ?? 0);
      existing.rows.push(row.rowNumber);
      existing.warnings.push(`Digabung dengan baris ${row.rowNumber} (nama dan satuan sama).`);
      if (row.notes) existing.notes = [existing.notes, row.notes].filter(Boolean).join(" · ");
      continue;
    }
    const warnings = [];
    if (!row.price) warnings.push("Harga satuan kosong; dicatat Rp 0 sampai dilengkapi.");
    if (row.qty === 0) warnings.push("Stok 0; barang tetap didaftarkan tanpa saldo.");
    items.set(key, {
      key,
      name: row.name,
      group,
      unit: unit.unit,
      decimals: unit.decimals,
      qty: row.qty,
      price: row.price ?? 0,
      notes: row.notes,
      rows: [row.rowNumber],
      warnings,
    });
  }
  const list = [...items.values()];
  return {
    items: list,
    blocked,
    summary: {
      rows: rows.length,
      items: list.length,
      blocked: blocked.length,
      merged: rows.length - blocked.length - list.length,
      withStock: list.filter((i) => i.qty > 0).length,
      noPrice: list.filter((i) => !i.price).length,
      value: Math.round(list.reduce((s, i) => s + i.qty * i.price, 0)),
    },
  };
}
