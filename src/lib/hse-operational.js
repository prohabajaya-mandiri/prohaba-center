// Ringkasan data operasional ERP untuk E-HSE (alat & pemeliharaan, absensi). Fungsi murni agar dapat diuji.
const DAY = 86400000;
export const DUE_SOON_DAYS = 14;
export const MAX_ATTENDANCE_DAYS = 62;
export const MAX_EQUIPMENT_DAYS = 400;

/** Rentang tanggal YYYY-MM-DD (UTC tengah malam) dengan batas panjang. */
export function parseRange(params, maxDays) {
  const d = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T00:00:00Z") : null);
  const from = d(params.get("from"));
  const to = d(params.get("to"));
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return null;
  if ((to - from) / DAY + 1 > maxDays) return null;
  return { from, to };
}

/**
 * Status servis per unit: jadwal servis berikutnya diambil dari catatan pemeliharaan terbaru yang memilikinya.
 * `logs` urut terbaru dulu. Terlambat bila jadwal sebelum `asOf`; mendekati bila ≤ DUE_SOON_DAYS.
 */
export function unitServiceStatus(logs, { from, to, asOf }) {
  const last = logs[0] ?? null;
  const planned = logs.find((l) => l.nextServiceDate || l.nextServiceMeter) ?? null;
  const next = planned?.nextServiceDate ? new Date(planned.nextServiceDate) : null;
  const inPeriod = logs.filter((l) => new Date(l.date) >= from && new Date(l.date) <= to);
  let due = "TANPA_JADWAL";
  if (next) due = next < asOf ? "TERLAMBAT" : next <= new Date(asOf.getTime() + DUE_SOON_DAYS * DAY) ? "MENDEKATI" : "TERJADWAL";
  else if (planned?.nextServiceMeter) due = "TERJADWAL_METER";
  return {
    lastServiceDate: last ? new Date(last.date) : null,
    lastServiceType: last?.type ?? null,
    nextServiceDate: next,
    nextServiceMeter: planned?.nextServiceMeter ?? null,
    servicesInPeriod: inPeriod.length,
    due,
  };
}

export function equipmentSummary(units) {
  const byType = {};
  const byDue = {};
  for (const u of units) {
    byType[u.type] = (byType[u.type] ?? 0) + 1;
    byDue[u.service.due] = (byDue[u.service.due] ?? 0) + 1;
  }
  return { units: units.length, byType, byDue, servicesInPeriod: units.reduce((s, u) => s + u.service.servicesInPeriod, 0) };
}

/** Rekap absensi per tanggal: hadir = status HADIR; tercatat = semua status pada tanggal itu. */
export function attendanceDays(groups) {
  const days = {};
  for (const g of groups) {
    const key = new Date(g.date).toISOString().slice(0, 10);
    const row = (days[key] ??= { date: key, present: 0, recorded: 0, overtimeHours: 0 });
    row.recorded += g.count;
    if (g.status === "HADIR") row.present += g.count;
    row.overtimeHours += Number(g.overtime ?? 0);
  }
  return Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
}
