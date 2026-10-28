// Tanda HSE pada absensi dan pengambilan BBM. Tidak memblokir: karyawan tetap bisa absen dan mengambil BBM
// (ada kasus tertentu di lapangan), tetapi catatannya ditandai agar HRD/HSE/Logistik menindaklanjuti.
// Berkas ini aman dipakai di client (tanpa Prisma).

export const HSE_FLAG_LABELS = {
  MCU_UNFIT: "MCU UNFIT",
  MCU_KEDALUWARSA: "MCU kedaluwarsa",
  SIMPER_TIDAK_BERLAKU: "SIMPER/KIMPER tidak berlaku",
};

/** Permit yang wajib dimiliki pengambil BBM untuk unit yang dikemudikan/dioperasikan. */
export const DRIVING_PERMIT = /^\s*(SIMPER|KIMPER)\b/i;
export const PERMIT_UNIT_TYPES = ["ALAT_BERAT", "KENDARAAN"];

const day = (v) => new Date(new Date(v).toISOString().slice(0, 10) + "T00:00:00Z").getTime();

/**
 * Tanda HSE pada waktu `at`.
 * - `mcu`: { result, validUntil } MCU terakhir; null = belum ada MCU; undefined = data belum diterima dari E-HSE.
 * - `permits`: permit personel { hseSiteId, permitType, startDate, endDate, revokedAt }; undefined = belum diterima.
 * - `needsPermit`: unit alat berat/kendaraan → wajib SIMPER/KIMPER yang berlaku di `siteId` (bila diketahui).
 */
export function hseFlags({ mcu, permits, at, needsPermit = false, siteId = null }) {
  const flags = [];
  const today = day(at);
  if (mcu?.result === "UNFIT") flags.push("MCU_UNFIT");
  else if (mcu?.validUntil && day(mcu.validUntil) < today) flags.push("MCU_KEDALUWARSA");
  if (needsPermit && permits) {
    const valid = permits.some(
      (p) =>
        DRIVING_PERMIT.test(p.permitType) &&
        (!siteId || p.hseSiteId === siteId) &&
        day(p.startDate) <= today &&
        day(p.endDate) >= today &&
        !(p.revokedAt && new Date(p.revokedAt) <= new Date(at)),
    );
    if (!valid) flags.push("SIMPER_TIDAK_BERLAKU");
  }
  return flags;
}

/** Teks untuk HP PIC/petugas BBM: tanpa rincian medis (UNFIT vs kedaluwarsa hanya untuk HRD/HSE). */
export function fieldHseNote(flags) {
  if (!flags?.length) return null;
  const parts = [...new Set(flags.map((f) => (f.startsWith("MCU") ? "MCU tidak berlaku" : HSE_FLAG_LABELS[f] ?? f)))];
  return `Catatan HSE: ${parts.join(", ")}. Tetap tercatat dan dilaporkan.`;
}
