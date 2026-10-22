// Aturan absensi barcode yang dipakai bersama oleh kiosk, rekap dan server.
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
