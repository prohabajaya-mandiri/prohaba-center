// Aturan BBM drum site yang dipakai bersama oleh web petugas BBM, dashboard HO dan server.
// Berkas ini aman dipakai di client (tanpa Prisma/crypto).

/** Isi standar satu drum (liter). HO tetap mengisi total liter per pengiriman. */
export const DRUM_LITERS = 200;

export const FUEL_METHODS = {
  FLOW_METER: 'Flow meter',
  TAKARAN: 'Takaran (jeriken/ember)',
  PERKIRAAN: 'Perkiraan',
};

/** Selisih opname yang masih wajar: 2% dari BBM keluar sejak opname sebelumnya, minimal 10 L (sisa dasar drum, penguapan). */
export const COUNT_TOLERANCE = 0.02;
export const COUNT_TOLERANCE_MIN_LITERS = 10;
/** Opname dianggap terlambat setelah sekian hari. */
export const COUNT_DUE_DAYS = 7;
/** Jendela pemakaian untuk pengajuan drum dan perkiraan hari stok cukup. */
export const USAGE_WINDOW_DAYS = 14;
/** Batas satu kali pengambilan; di atas LARGE_ISSUE_LITERS petugas diminta konfirmasi dan HO melihat tandanya. */
export const MAX_ISSUE_LITERS = 1000;
export const LARGE_ISSUE_LITERS = 200;
/** Kiriman dianggap kurang bila liter diterima lebih kecil dari ini terhadap liter dikirim. */
export const RECEIPT_TOLERANCE = 0.005;
/** Rasio pemakaian unit dianggap boros bila melebihi median unit itu sebanyak ini. */
export const CONSUMPTION_FACTOR = 1.5;
/** Catatan offline paling lama yang masih diterima (site tambang bisa berhari-hari tanpa sinyal). */
export const FUEL_OFFLINE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const SHIPMENT_STATUS = { SENT: 'Dalam perjalanan', RECEIVED: 'Diterima site', CANCELLED: 'Dibatalkan' };
export const SHIPMENT_TONE = { SENT: 'info', RECEIVED: 'success', CANCELLED: 'gray' };
export const REQUEST_STATUS = { SUBMITTED: 'Menunggu persetujuan', APPROVED: 'Disetujui', REJECTED: 'Ditolak', SHIPPED: 'Sudah dikirim' };
export const REQUEST_TONE = { SUBMITTED: 'warning', APPROVED: 'navy', REJECTED: 'danger', SHIPPED: 'success' };

/** Satuan meter unit: HM (jam) untuk alat berat/genset, km untuk kendaraan, tanpa meter untuk alat kecil. */
export function meterUnit(type) {
  if (type === 'KENDARAAN') return 'km';
  if (type === 'ALAT_BERAT' || type === 'GENSET') return 'HM';
  return null;
}

/** Genset boleh tanpa HM (diganti lama nyala); alat kecil tidak punya meter. */
export const meterRequired = (type) => type === 'KENDARAAN' || type === 'ALAT_BERAT';

/**
 * Waktu catatan menurut server. Jam HP bisa salah, jadi selisih `sentAt` (jam HP saat mengirim)
 * terhadap jam server dipakai untuk mengoreksi `at`. Mengembalikan { at } atau { error }.
 */
export function resolveEntryTime(at, sentAt, now = new Date()) {
  const local = new Date(at), sent = new Date(sentAt);
  if (typeof at !== 'string' || typeof sentAt !== 'string' || !Number.isFinite(local.getTime()) || !Number.isFinite(sent.getTime()))
    return { error: 'Waktu catatan tidak valid.' };
  if (local - sent > 60 * 1000) return { error: 'Waktu catatan tidak valid.' };
  const corrected = new Date(local.getTime() + (now - sent));
  if (now - corrected > FUEL_OFFLINE_WINDOW_MS) return { error: 'Catatan offline lebih dari 7 hari tidak diterima. Laporkan ke Logistik HO.' };
  return { at: corrected };
}

const round = (n) => Math.round(n * 10) / 10;

/** Batas selisih opname yang masih wajar untuk sejumlah liter BBM keluar. */
export const countTolerance = (issued) => Math.max(COUNT_TOLERANCE_MIN_LITERS, issued * COUNT_TOLERANCE);

/**
 * Buku stok BBM satu site. Stok = hasil opname terakhir + diterima − dikeluarkan sesudahnya
 * (sebelum ada opname, patokannya 0). Setiap opname dibandingkan dengan stok sistem saat itu.
 * receipts/issues: [{ at, liters }], counts: [{ id, at, totalLiters }].
 */
export function fuelLedger({ receipts = [], issues = [], counts = [] }) {
  const events = [
    ...receipts.map((r) => ({ kind: 'in', at: new Date(r.at), liters: r.liters })),
    ...issues.map((i) => ({ kind: 'out', at: new Date(i.at), liters: i.liters })),
    ...counts.map((c) => ({ kind: 'count', at: new Date(c.at), liters: c.totalLiters, id: c.id })),
  ].sort((a, b) => a.at - b.at || (a.kind === 'count') - (b.kind === 'count'));
  let stock = 0, issued = 0, received = 0;
  const results = [];
  for (const e of events) {
    if (e.kind === 'in') {
      stock += e.liters;
      received += e.liters;
    } else if (e.kind === 'out') {
      stock -= e.liters;
      issued += e.liters;
    } else {
      const variance = e.liters - stock;
      results.push({
        id: e.id,
        at: e.at,
        physical: round(e.liters),
        system: round(stock),
        variance: round(variance),
        issuedSince: round(issued),
        receivedSince: round(received),
        flagged: Math.abs(variance) > countTolerance(issued),
      });
      stock = e.liters;
      issued = 0;
      received = 0;
    }
  }
  return { stock: round(stock), counts: results, lastCount: results.at(-1) ?? null };
}

/** Pemakaian dalam jendela USAGE_WINDOW_DAYS dan perkiraan berapa hari stok cukup. */
export function usageStats(issues, stock, now = new Date()) {
  const from = now.getTime() - USAGE_WINDOW_DAYS * 86400000;
  const usage = issues.filter((i) => new Date(i.at).getTime() >= from).reduce((s, i) => s + i.liters, 0);
  const perDay = usage / USAGE_WINDOW_DAYS;
  return { usage: round(usage), perDay: round(perDay), daysCover: perDay > 0 ? Math.max(0, Math.floor(stock / perDay)) : null };
}

const median = (values) => {
  const v = [...values].sort((a, b) => a - b), mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

/**
 * Rasio pemakaian satu unit dari catatan berurutan waktu: liter per HM/km sejak pengisian sebelumnya,
 * atau liter per jam nyala (genset tanpa HM). Menandai meter mundur dan rasio jauh di atas median unit itu.
 * logs: [{ id, at, liters, meterValue, runHours }] → { rates: [{ id, at, rate }], median, flags: [{ id, at, kind, rate?, delta? }] }
 */
export function consumption(logs) {
  const sorted = [...logs].sort((a, b) => new Date(a.at) - new Date(b.at));
  const rates = [], flags = [];
  let previous = null;
  for (const log of sorted) {
    if (log.runHours > 0) rates.push({ id: log.id, at: log.at, rate: log.liters / log.runHours });
    else if (log.meterValue != null) {
      if (previous) {
        const delta = log.meterValue - previous.meterValue;
        if (delta < 0) flags.push({ id: log.id, at: log.at, kind: 'METER_BACKWARD', delta });
        else if (delta > 0) rates.push({ id: log.id, at: log.at, rate: log.liters / delta });
      }
      previous = log;
    }
  }
  const mid = rates.length ? median(rates.map((r) => r.rate)) : null;
  if (rates.length >= 4 && mid > 0)
    for (const r of rates) if (r.rate > mid * CONSUMPTION_FACTOR) flags.push({ id: r.id, at: r.at, kind: 'HIGH_RATE', rate: r.rate });
  return { rates, median: mid, flags };
}

/** Rasio untuk ditampilkan: km/L untuk kendaraan, L/HM (atau L/jam) untuk lainnya. */
export function formatRate(rate, type) {
  if (!rate) return '-';
  return type === 'KENDARAAN' ? `${(1 / rate).toFixed(2)} km/L` : `${rate.toFixed(2)} L/${type === 'GENSET' ? 'jam' : 'HM'}`;
}

export const liters = (n) => `${Number(n ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })} L`;
