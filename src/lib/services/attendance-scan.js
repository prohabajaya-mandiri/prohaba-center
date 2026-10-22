import { prisma } from "../prisma.js";
import { object, text, choice, array, ensure, InputError } from "../validation.js";
import { transaction, audit } from "../transactions.js";
import { decodeAttendanceQr } from "../attendance-qr.js";
import {
  DUPLICATE_WINDOW_MS,
  OFFLINE_FLAG_MS,
  SCAN_METHODS,
  SCAN_TIMEZONES,
  localDate,
  resolveScanTime,
} from "../attendance-scan.js";
import { STATUS } from "../ui-labels.js";

const TIMEZONES = SCAN_TIMEZONES.map(([tz]) => tz);
const CLIENT_ID = /^[A-Za-z0-9-]{8,64}$/;
const employeeCard = { id: true, nip: true, name: true, position: true };

/**
 * Terima antrean scan dari HP PIC absensi (langsung atau setelah offline).
 * Setiap scan diproses sendiri: yang ditolak tidak menggagalkan yang lain, dan
 * scan dengan clientId yang sudah tersimpan tidak dicatat dua kali.
 */
export async function syncScans(body, user) {
  object(body, ["sentAt", "scans"]);
  const items = array(body.scans, "Scan", 100);
  const now = new Date();
  const parsed = items.map((item) => {
    object(item, ["clientId", "code", "scannedAt", "timeZone", "method"]);
    const clientId = text(item.clientId, "Id scan", 64);
    ensure(CLIENT_ID.test(clientId), "Id scan tidak valid.");
    return { ...item, clientId };
  });
  parsed.sort((a, b) => String(a.scannedAt).localeCompare(String(b.scannedAt)));
  const results = [];
  for (const item of parsed) {
    try {
      results.push({ clientId: item.clientId, ...(await processScan(item, body.sentAt, user, now)) });
    } catch (error) {
      if (!(error instanceof InputError)) throw error;
      results.push({ clientId: item.clientId, status: "rejected", message: error.message });
    }
  }
  return { results };
}

async function processScan(item, sentAt, user, now) {
  const stored = await prisma.attendanceScan.findUnique({
    where: { clientId: item.clientId },
    select: { scannedAt: true, attendanceId: true, employee: { select: employeeCard }, project: { select: { name: true } } },
  });
  if (stored) {
    const count = await prisma.attendanceScan.count({ where: { attendanceId: stored.attendanceId } });
    return { status: "ok", employee: stored.employee, projectName: stored.project.name, scannedAt: stored.scannedAt, count };
  }

  const code = text(item.code, "Kode QR", 100),
    timeZone = choice(item.timeZone, TIMEZONES, "Zona waktu"),
    method = choice(item.method, SCAN_METHODS, "Metode scan");
  const employeeNo = decodeAttendanceQr(code);
  ensure(employeeNo, "Kartu tidak dikenali. Gunakan kartu QR absensi resmi.", 422);
  const time = resolveScanTime(item.scannedAt, sentAt, now);
  ensure(time.at, time.error);
  const at = time.at,
    day = localDate(at, timeZone),
    date = new Date(day + "T00:00:00Z");

  const found = await prisma.employee.findUnique({
    where: { employeeNo },
    select: {
      ...employeeCard,
      isActive: true,
      projects: {
        where: {
          startDate: { lte: date },
          OR: [{ endDate: null }, { endDate: { gte: date } }],
          project: { status: "ACTIVE" },
        },
        select: { projectId: true, project: { select: { name: true } } },
        orderBy: { startDate: "desc" },
      },
    },
  });
  ensure(found, "Karyawan dengan kartu ini tidak ditemukan.", 404);
  const { projects: assignments, isActive, ...employee } = found;
  ensure(isActive, `${employee.name} tidak lagi aktif.`, 409);

  return transaction(async (tx) => {
    let attendance = await tx.attendance.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date } },
      include: {
        project: { select: { name: true } },
        scans: { select: { scannedAt: true } },
      },
    });
    let projectId, projectName, count = 0;
    if (attendance) {
      // Proyek hari itu sudah ditentukan oleh scan/absensi pertama.
      ensure(
        attendance.status === "HADIR",
        `${employee.name} tercatat ${STATUS[attendance.status]?.[0] ?? attendance.status} hari ini. Hubungi HRD untuk mengubahnya.`,
        409,
      );
      ensure(attendance.projectId, `Absensi ${employee.name} hari ini belum berproyek. Hubungi HRD.`, 409);
      projectId = attendance.projectId;
      projectName = attendance.project.name;
      count = attendance.scans.length;
      // Antrean offline bisa tiba tidak berurutan, jadi bandingkan dengan scan terdekat.
      const near = attendance.scans.find((s) => Math.abs(s.scannedAt - at) < DUPLICATE_WINDOW_MS);
      if (near)
        return { status: "duplicate", employee, projectName, scannedAt: near.scannedAt, count };
    } else {
      // Proyek otomatis dari penugasan; bila lebih dari satu, penugasan terbaru dipakai.
      ensure(assignments.length, `${employee.name} tidak punya penugasan proyek aktif pada ${day}.`, 409);
      ({ projectId, project: { name: projectName } } = assignments[0]);
      const locked = await tx.payroll.findUnique({
        where: { projectId_period: { projectId, period: day.slice(0, 7) } },
      });
      ensure(!locked, `Payroll ${projectName} periode ini sudah dibuat; absensi dikunci.`, 409);
      attendance = await tx.attendance.create({
        data: {
          employeeId: employee.id,
          projectId,
          date,
          status: "HADIR",
          enteredBy: user.id,
          notes: "Scan barcode",
        },
      });
      await audit(tx, user, "ATTENDANCE", "CREATE", attendance.id, null, attendance);
    }
    await tx.attendanceScan.create({
      data: {
        clientId: item.clientId,
        attendanceId: attendance.id,
        employeeId: employee.id,
        projectId,
        date,
        scannedAt: at,
        receivedAt: now,
        timeZone,
        method,
        scannedBy: user.id,
      },
    });
    return { status: "ok", employee, projectName, scannedAt: at, count: count + 1 };
  });
}

/**
 * Daftar karyawan aktif untuk menampilkan nama & NIP di HP PIC saat offline (tanpa data sensitif).
 * Kode internal ikut dikirim hanya untuk mencocokkan isi QR, tidak ditampilkan.
 */
export async function scanRoster() {
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { employeeNo: true, nip: true, name: true, position: true },
    orderBy: { employeeNo: "asc" },
    take: 5000,
  });
  return { employees, at: new Date() };
}

/** Rekap scan per karyawan pada satu tanggal, opsional per proyek. */
export async function scanRecap(day, projectId) {
  const date = new Date(day + "T00:00:00Z");
  const scans = await prisma.attendanceScan.findMany({
    where: { date, ...(projectId ? { projectId } : {}) },
    orderBy: { scannedAt: "asc" },
    take: 10000,
    select: {
      scannedAt: true,
      receivedAt: true,
      timeZone: true,
      method: true,
      scanUser: { select: { name: true } },
      employee: { select: { id: true, name: true, nip: true, position: true } },
      project: { select: { id: true, name: true } },
    },
  });
  const byEmployee = new Map();
  for (const s of scans) {
    const key = s.employee.id + ":" + s.project.id;
    if (!byEmployee.has(key))
      byEmployee.set(key, { ...s.employee, projectName: s.project.name, scans: [] });
    byEmployee.get(key).scans.push({
      at: s.scannedAt.toISOString(),
      timeZone: s.timeZone,
      method: s.method,
      by: s.scanUser.name,
      // Diterima server jauh setelah di-scan = dikirim dari antrean offline HP PIC.
      receivedAt: s.receivedAt - s.scannedAt > OFFLINE_FLAG_MS ? s.receivedAt.toISOString() : null,
    });
  }
  const rows = [...byEmployee.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
  // Karyawan yang ditugaskan di proyek pada tanggal itu tetapi belum scan sama sekali.
  let missing = [];
  if (projectId) {
    const scanned = new Set(rows.map((r) => r.id));
    const assignments = await prisma.employeeProject.findMany({
      where: {
        projectId,
        startDate: { lte: date },
        OR: [{ endDate: null }, { endDate: { gte: date } }],
        employee: { isActive: true },
      },
      select: { employee: { select: { id: true, name: true, nip: true, position: true } } },
      orderBy: { employee: { name: "asc" } },
    });
    missing = assignments.map((a) => a.employee).filter((e) => !scanned.has(e.id));
  }
  return { rows, missing };
}
