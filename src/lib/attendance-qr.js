// Isi QR kartu absensi: "PRHB1.<kode karyawan>.<tanda tangan>".
// Tanda tangan HMAC mencegah QR dibuat sendiri dari kode karyawan orang lain;
// kartu yang sudah dicetak tetap berlaku selama ATTENDANCE_QR_SECRET tidak diganti.
import { createHmac, timingSafeEqual } from 'node:crypto';

const PREFIX = 'PRHB1';
const SIGNATURE_LENGTH = 12;
const PATTERN = /^PRHB1\.([A-Za-z0-9-]{1,40})\.([A-Za-z0-9_-]{12})$/;

function secret() {
  const value = process.env.ATTENDANCE_QR_SECRET;
  if (!value || value.length < 32) throw new Error('ATTENDANCE_QR_SECRET belum diatur (min. 32 karakter).');
  return value;
}

function sign(employeeNo) {
  return createHmac('sha256', secret()).update(PREFIX + '.' + employeeNo).digest('base64url').slice(0, SIGNATURE_LENGTH);
}

export function encodeAttendanceQr(employeeNo) {
  return `${PREFIX}.${employeeNo}.${sign(employeeNo)}`;
}

/** Kode karyawan dari isi QR, atau null bila format/tanda tangan tidak sah. */
export function decodeAttendanceQr(value) {
  const match = typeof value === 'string' ? PATTERN.exec(value.trim()) : null;
  if (!match) return null;
  const expected = Buffer.from(sign(match[1])), actual = Buffer.from(match[2]);
  return timingSafeEqual(expected, actual) ? match[1] : null;
}
