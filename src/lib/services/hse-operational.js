// Data operasional ERP per site E-HSE (lewat Project.hseSiteId), dibaca E-HSE untuk bukti CSMS & HSE Performance.
import { prisma } from "../prisma.js";
import { ensure } from "../validation.js";
import { attendanceDays, equipmentSummary, MAX_ATTENDANCE_DAYS, MAX_EQUIPMENT_DAYS, parseRange, unitServiceStatus } from "../hse-operational.js";

const DAY = 86400000;
// Unit dianggap beroperasi di site bila ada pengisian BBM atau pemeliharaan pada proyek site itu dalam 90 hari terakhir periode.
const ACTIVE_WINDOW_DAYS = 90;

async function siteProjects(params) {
  const hseSiteId = params.get("hseSiteId");
  ensure(typeof hseSiteId === "string" && /^[a-z0-9]{8,40}$/i.test(hseSiteId), "hseSiteId tidak valid.");
  return prisma.project.findMany({ where: { hseSiteId }, select: { id: true, code: true, name: true, client: true, status: true } });
}

export async function equipmentForSite(params, now = new Date()) {
  const range = parseRange(params, MAX_EQUIPMENT_DAYS);
  ensure(range, `Rentang tanggal tidak valid (maks. ${MAX_EQUIPMENT_DAYS} hari).`);
  const projects = await siteProjects(params);
  if (!projects.length) return { projects, units: [], summary: null, definition: "Belum ada proyek ERP yang ditautkan ke site ini." };
  const projectIds = projects.map((p) => p.id);
  const windowStart = new Date(range.to.getTime() - ACTIVE_WINDOW_DAYS * DAY);
  const asOf = range.to < now ? range.to : now;
  const vehicles = await prisma.vehicle.findMany({
    where: {
      status: { not: "INACTIVE" },
      OR: [
        { fuelLogs: { some: { projectId: { in: projectIds }, voidedAt: null, date: { gte: windowStart, lte: range.to } } } },
        { maintenanceLogs: { some: { projectId: { in: projectIds }, date: { gte: windowStart, lte: range.to } } } },
      ],
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    take: 1000,
    select: {
      code: true, name: true, type: true, plateNumber: true, status: true,
      maintenanceLogs: { where: { date: { lte: range.to } }, orderBy: { date: "desc" }, take: 30, select: { date: true, type: true, nextServiceDate: true, nextServiceMeter: true } },
    },
  });
  const units = vehicles.map(({ maintenanceLogs, ...v }) => ({ ...v, service: unitServiceStatus(maintenanceLogs, { ...range, asOf }) }));
  return {
    projects, units, summary: equipmentSummary(units), asOf,
    definition: `Unit dengan pengisian BBM atau pemeliharaan pada proyek site ini dalam ${ACTIVE_WINDOW_DAYS} hari sampai akhir periode.`,
  };
}

export async function attendanceForSite(params) {
  const range = parseRange(params, MAX_ATTENDANCE_DAYS);
  ensure(range, `Rentang tanggal tidak valid (maks. ${MAX_ATTENDANCE_DAYS} hari).`);
  const projects = await siteProjects(params);
  if (!projects.length) return { projects, days: [], definition: "Belum ada proyek ERP yang ditautkan ke site ini." };
  const groups = await prisma.attendance.groupBy({
    by: ["date", "status"],
    where: { projectId: { in: projects.map((p) => p.id) }, date: { gte: range.from, lte: range.to } },
    _count: true,
    _sum: { overtime: true },
  });
  return {
    projects,
    days: attendanceDays(groups.map((g) => ({ date: g.date, status: g.status, count: g._count, overtime: g._sum.overtime }))),
    definition: "Hadir = absensi berstatus HADIR pada proyek ERP yang ditautkan ke site ini.",
  };
}
