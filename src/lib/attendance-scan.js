// Aturan absensi barcode yang dipakai bersama oleh web absensi lapangan, rekap dan server.
// Berkas ini aman dipakai di client (tanpa Prisma/crypto).

/** Jumlah scan minimum per hari agar kehadiran dianggap lengkap. */
export const MIN_SCANS = 3;

/** Scan ulang kartu yang sama dalam jeda ini diabaikan (tidak dicatat dua kali). */
export const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

export const SCAN_TIMEZONES = [
  ['Asia/Jakarta', 'WIB'],
  ['Asia/Makassar', 'WITA'],
  ['Asia/Jayapura', 'WIT'],
];
export const DEFAULT_TIMEZONE = 'Asia/Makassar';

export const SCAN_METHODS = ['SCANNER', 'KAMERA'];

/** Scan offline paling lama yang masih diterima saat HP PIC kembali online. */
export const OFFLINE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Scan yang diterima server lebih lambat dari ini ditandai sebagai scan offline di rekap. */
export const OFFLINE_FLAG_MS = 2 * 60 * 1000;

/**
 * Jam scan menurut server. Jam HP bisa salah, jadi selisihnya dihitung dari `sentAt`
 * (jam HP saat mengirim) terhadap jam server saat menerima, lalu dipakai untuk mengoreksi `scannedAt`.
 * Mengembalikan { at } atau { error }.
 */
export function resolveScanTime(scannedAt, sentAt, now = new Date()) {
  const scanned = new Date(scannedAt), sent = new Date(sentAt);
  if (typeof scannedAt !== 'string' || typeof sentAt !== 'string' || !Number.isFinite(scanned.getTime()) || !Number.isFinite(sent.getTime()))
    return { error: 'Jam scan tidak valid.' };
  if (scanned - sent > 60 * 1000) return { error: 'Jam scan tidak valid.' };
  const at = new Date(scanned.getTime() + (now - sent));
  if (now - at > OFFLINE_WINDOW_MS) return { error: 'Scan offline lebih dari 3 hari tidak diterima.' };
  return { at };
}

/** Tanggal lokal (YYYY-MM-DD) dari sebuah waktu pada zona waktu tertentu. */
export function localDate(at, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** Jam lokal (HH:MM) dari sebuah waktu pada zona waktu tertentu. */
export function localTime(at, timeZone) {
  return new Intl.DateTimeFormat('id-ID', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at)).replace('.', ':');
}

export function timeZoneLabel(timeZone) {
  return SCAN_TIMEZONES.find(([tz]) => tz === timeZone)?.[1] ?? timeZone;
}
