// Aturan register aset PJM yang dipakai server dan client (tanpa Prisma).
// Format nomor: PJM/<kategori>/<bulan Romawi>/<tahun 2 digit>/<nomor urut>, mis. PJM/MPK/XII/25/0085.

export const ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

// Tarif garis lurus per golongan; tarif per aset boleh berbeda (dibawa dari register lama).
export const STANDARD_RATES = { "Gol 1": 0.25, "Gol 2": 0.125, "Gol 3": 0.0625, "Gol 4": 0.05, "Tidak Permanen": 0.25 };

export const ASSET_CONDITION = {
  BAIK: "Baik",
  PERLU_PERBAIKAN: "Perlu perbaikan",
  RUSAK: "Rusak",
  HILANG: "Hilang",
};
export const CONDITION_TONE = { BAIK: "success", PERLU_PERBAIKAN: "warning", RUSAK: "danger", HILANG: "danger" };

// Peran yang boleh melihat harga dan nilai buku (jawaban kuesioner M2).
export const PRICE_ROLES = ["TOP_MANAGEMENT", "FINANCE", "LOGISTIK"];
// Admin aset (keputusan utama no. 6: Logistik).
export const ASSET_ADMIN_ROLES = ["TOP_MANAGEMENT", "LOGISTIK"];

const CODE = /PJM\/([A-Z]+)\/([IVX]+)\/(\d{2})\/(\d+)/g;

/** Semua nomor register yang tertulis di satu sel (satu nomor, dua nomor, atau "A S/D B"). */
export function findRegisterCodes(text) {
  return [...String(text ?? "").toUpperCase().matchAll(CODE)].map((m) => ({
    category: m[1],
    month: ROMAN_MONTHS.indexOf(m[2]) + 1,
    year: 2000 + Number(m[3]),
    seq: Number(m[4]),
    width: m[4].length,
    prefix: `PJM/${m[1]}/${m[2]}/${m[3]}`,
  }));
}

export function registerNumber(category, date, seq, width = 4) {
  const d = new Date(date);
  return [
    "PJM",
    category,
    ROMAN_MONTHS[d.getUTCMonth()],
    String(d.getUTCFullYear() % 100).padStart(2, "0"),
    String(seq).padStart(width, "0"),
  ].join("/");
}

/**
 * Nilai buku per akhir tahun: garis lurus, mulai tahun setelah perolehan, tidak kurang dari 0.
 * Sama dengan rumus register Excel (total − total × tarif × (tahun − tahun perolehan)).
 */
export function bookValue({ unitPrice, quantity = 1, depreciationRate, acquiredAt }, year) {
  if (unitPrice == null || !acquiredAt) return null;
  const total = Number(unitPrice) * quantity;
  const years = Math.max(0, year - new Date(acquiredAt).getUTCFullYear());
  return Math.max(0, total * (1 - Number(depreciationRate ?? 0) * years));
}
