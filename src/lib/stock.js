// Aturan kartu stok gudang yang dipakai server dan client (tanpa Prisma).
// docs/gudang-ho.md

export const STOCK_ADMIN_ROLES = ["TOP_MANAGEMENT", "LOGISTIK"];

export const DOC_TYPES = {
  SALDO_AWAL: { label: "Saldo awal", prefix: "GSA" },
  MASUK: { label: "Barang masuk", prefix: "GM" },
  KELUAR: { label: "Barang keluar", prefix: "GK" },
  RETUR: { label: "Retur dari proyek", prefix: "GR" },
  PINDAH: { label: "Pindah lokasi", prefix: "GP" },
};
// Jenis yang dibuat lewat form transaksi (saldo awal hanya lewat import).
export const ENTRY_TYPES = ["MASUK", "KELUAR", "RETUR", "PINDAH"];

export const LOCATION_TYPES = { RAK: "Rak", BIN: "Bin", LANTAI: "Zona lantai", PENAMPUNG: "Penampung (belum ditata)" };
export const HOLDING_LOCATION = "HO-PENAMPUNG";

// Satuan baku; m dan ltr boleh desimal (pipa dipotong, cairan).
const UNITS = {
  bh: "bh", buah: "bh", unit: "unit", set: "set", psg: "psg", pasang: "psg", m: "m", "m'": "m", meter: "m",
  roll: "roll", lbr: "lbr", lembar: "lbr", btg: "btg", batang: "btg", klg: "klg", kaleng: "klg",
  ltr: "ltr", liter: "ltr", gln: "gln", galon: "gln", pcs: "pcs", dus: "dus", box: "dus", kg: "kg",
};
export const DECIMAL_UNITS = ["m", "ltr", "kg"];
export const STANDARD_UNITS = [...new Set(Object.values(UNITS))];

export function normalizeUnit(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  const unit = UNITS[raw] ?? UNITS[raw.replace(/\.$/, "")] ?? null;
  return unit ? { unit, decimals: DECIMAL_UNITS.includes(unit) } : null;
}

/** Kode lokasi: HO-R1-T3, HO-R1-T3-B04, HO-LT-02. */
export function locationCode({ type, bay, level, bin, zone, warehouse = "HO" }) {
  const two = (n) => String(n).padStart(2, "0");
  if (type === "RAK") return `${warehouse}-R${bay}-T${level}`;
  if (type === "BIN") return `${warehouse}-R${bay}-T${level}-B${two(bin)}`;
  if (type === "LANTAI") return `${warehouse}-LT-${two(zone)}`;
  return `${warehouse}-PENAMPUNG`;
}

const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Harga rata-rata bergerak dari kartu stok (urut tanggal). Hanya saldo awal dan barang masuk yang
 * mengubah rata-rata; retur masuk dengan harga rata-rata saat itu, keluar dan pindah tidak mengubahnya.
 */
export function averageCost(movements) {
  let qty = 0;
  let avg = 0;
  for (const m of movements) {
    const q = Number(m.qty);
    if ((m.type === "MASUK" || m.type === "SALDO_AWAL") && q > 0) {
      avg = qty > 0 ? (qty * avg + q * Number(m.unitCost)) / (qty + q) : Number(m.unitCost);
    }
    qty = round(qty + q);
  }
  return { qty, avgCost: Math.round(avg * 100) / 100 };
}

/** Senin–Minggu minggu yang memuat tanggal YYYY-MM-DD (UTC). */
export function weekRange(day) {
  const d = new Date(day + "T00:00:00Z");
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

/**
 * Laporan mingguan format Excel lama: stok minggu lalu, masuk, keluar, stok akhir, nilai.
 * Pindah lokasi tidak dihitung (masuk dan keluarnya saling meniadakan).
 */
export function weeklyReport(items, movements, { start, end }) {
  const rows = new Map(items.map((i) => [i.id, { ...i, opening: 0, inQty: 0, outQty: 0 }]));
  for (const m of movements) {
    const row = rows.get(m.itemId);
    const at = new Date(m.docDate);
    if (!row || at >= end) continue;
    const q = Number(m.qty);
    // Saldo awal selalu menjadi stok minggu lalu, juga pada minggu tanggal opname-nya.
    if (at < start || m.type === "SALDO_AWAL") row.opening = round(row.opening + q);
    else if (m.type !== "PINDAH") {
      if (q > 0) row.inQty = round(row.inQty + q);
      else row.outQty = round(row.outQty - q);
    }
  }
  return [...rows.values()].map((r) => {
    const closing = round(r.opening + r.inQty - r.outQty);
    return { ...r, closing, value: Math.round(closing * Number(r.avgCost ?? 0)) };
  });
}

export const fmtQty = (v) => Number(v ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 3 });

/**
 * Isi QR yang dipindai: URL label (…/gudang/l/HO-R1-T2, …/gudang/b/MTR-ELC-0001) atau kodenya saja
 * (diketik manual atau dari pemindai USB).
 */
export function parseScan(value) {
  const text = String(value ?? "").trim();
  const path = text.match(/\/gudang\/([lb])\/([A-Za-z0-9-]+)\/?$/);
  if (path) return { kind: path[1] === "l" ? "location" : "item", code: decodeURIComponent(path[2]).toUpperCase() };
  const code = text.toUpperCase();
  if (/^MTR-[A-Z]{3}-\d{4,}$/.test(code)) return { kind: "item", code };
  if (/^[A-Z]{2,4}-[A-Z0-9-]+$/.test(code)) return { kind: "location", code };
  return null;
}
