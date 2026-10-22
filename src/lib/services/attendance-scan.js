import { prisma } from "../prisma.js";
import { object, text, choice, ensure } from "../validation.js";
import { transaction, audit } from "../transactions.js";
import { decodeAttendanceQr } from "../attendance-qr.js";
import {
  DUPLICATE_WINDOW_MS,
  SCAN_METHODS,
  SCAN_TIMEZONES,
  localDate,
} from "../attendance-scan.js";
import { STATUS } from "../ui-labels.js";

const TIMEZONES = SCAN_TIMEZONES.map(([tz]) => tz);
const employeeCard = {
  id: true,
  employeeNo: true,
  name: true,
  position: true,
  siteName: true,
  isActive: true,
};

/**
 * Catat satu scan kartu QR. Scan pertama dalam sehari membuat Attendance HADIR
 * untuk proyek kiosk (masuk ke payroll); scan berikutnya hanya menambah log jam.
 */
export async function scan(body, user) {
  object(body, ["code", "projectId", "timeZone", "method"]);
  const code = text(body.code, "Kode QR", 100),
    projectId = text(body.projectId, "Proyek"),
    timeZone = choice(body.timeZone, TIMEZONES, "Zona waktu"),
    method = choice(body.method, SCAN_METHODS, "Metode scan");
  const employeeNo = decodeAttendanceQr(code);
  ensure(employeeNo, "Kartu tidak dikenali. Gunakan kartu QR absensi resmi.", 422);
  const now = new Date(),
    day = localDate(now, timeZone),
    date = new Date(day + "T00:00:00Z");

  // Data rujukan dibaca paralel di luar transaksi agar scan terasa instan;
  // transaksi hanya berisi baca absensi hari ini + tulis (1–2 query pada scan berikutnya).
  const [employee, project] = await Promise.all([
    prisma.employee.findUnique({
      where: { employeeNo },
      select: { ...employeeCard, projects: { where: { projectId } } },
    }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, status: true },
    }),
  ]);
  ensure(employee, "Karyawan dengan kartu ini tidak ditemukan.", 404);
  const { projects: [assignment], ...profile } = employee;
  ensure(profile.isActive, `${profile.name} tidak lagi aktif.`, 409);
  ensure(project?.status === "ACTIVE", "Proyek kiosk tidak aktif.", 409);
  ensure(
    assignment &&
      assignment.startDate <= date &&
      (!assignment.endDate || assignment.endDate >= date),
    `${profile.name} tidak ditugaskan di ${project.name} hari ini.`,
    409,
  );
  const card = { ...profile, projectName: project.name };

  return transaction(async (tx) => {
    let attendance = await tx.attendance.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date } },
      include: {
        project: { select: { name: true } },
        scans: { select: { scannedAt: true }, orderBy: { scannedAt: "desc" } },
      },
    });
    let count = 0;
    if (attendance) {
      ensure(
        attendance.projectId === projectId,
        `${employee.name} sudah tercatat hadir di ${attendance.project?.name ?? "proyek lain"} hari ini.`,
        409,
      );
      ensure(
        attendance.status === "HADIR",
        `${employee.name} tercatat ${STATUS[attendance.status]?.[0] ?? attendance.status} hari ini. Hubungi HRD untuk mengubahnya.`,
        409,
      );
      count = attendance.scans.length;
      const last = attendance.scans[0];
      if (last && now - last.scannedAt < DUPLICATE_WINDOW_MS)
        return { duplicate: true, employee: card, scannedAt: last.scannedAt, count };
    } else {
      const locked = await tx.payroll.findUnique({
        where: { projectId_period: { projectId, period: day.slice(0, 7) } },
      });
      ensure(!locked, "Payroll periode ini sudah dibuat; absensi dikunci.", 409);
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
    const created = await tx.attendanceScan.create({
      data: {
        attendanceId: attendance.id,
        employeeId: employee.id,
        projectId,
        date,
        scannedAt: now,
        timeZone,
        method,
        scannedBy: user.id,
      },
    });
    return { duplicate: false, employee: card, scannedAt: created.scannedAt, count: count + 1 };
  });
}

/** Scan terakhir hari ini pada proyek kiosk, untuk daftar di layar kiosk. */
export async function todayScans(projectId, timeZone) {
  ensure(TIMEZONES.includes(timeZone), "Zona waktu tidak valid.");
  const date = new Date(localDate(new Date(), timeZone) + "T00:00:00Z");
  const [rows, present] = await Promise.all([
    prisma.attendanceScan.findMany({
      where: { projectId, date },
      orderBy: { scannedAt: "desc" },
      take: 30,
      select: {
        id: true,
        scannedAt: true,
        employee: { select: { name: true, employeeNo: true } },
      },
    }),
    prisma.attendanceScan.groupBy({
      by: ["employeeId"],
      where: { projectId, date },
    }),
  ]);
  return { scans: rows, present: present.length };
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
      timeZone: true,
      method: true,
      employee: { select: { id: true, name: true, employeeNo: true, position: true } },
      project: { select: { id: true, name: true } },
    },
  });
  const byEmployee = new Map();
  for (const s of scans) {
    const key = s.employee.id + ":" + s.project.id;
    if (!byEmployee.has(key))
      byEmployee.set(key, { ...s.employee, projectName: s.project.name, scans: [] });
    byEmployee.get(key).scans.push({ at: s.scannedAt.toISOString(), timeZone: s.timeZone, method: s.method });
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
      select: { employee: { select: { id: true, name: true, employeeNo: true, position: true } } },
      orderBy: { employee: { name: "asc" } },
    });
    missing = assignments.map((a) => a.employee).filter((e) => !scanned.has(e.id));
  }
  return { rows, missing };
}
