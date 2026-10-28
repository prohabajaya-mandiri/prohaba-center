import { canAccess } from "@/lib/access";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppLayout from "@/components/AppLayout";
import ListPager from "@/components/ListPager";
import { pageQuery } from "@/lib/page-query";
import HRClient from "./HRClient";
import { date } from "@/lib/validation";
import { ensureFreshEmployees } from "@/lib/services/employees";
import { currentTab, tabLabel } from "@/lib/module-tabs";
import { scanRecap } from "@/lib/services/attendance-scan";
import { attendanceCards } from "@/lib/attendance-cards";
import { DEFAULT_TIMEZONE, localDate } from "@/lib/attendance-scan";
import { ATTENDANCE_HRD_ROLES } from "@/lib/services/payroll";
import ScanRecap from "./ScanRecap";
import QrCards from "./QrCards";

export const metadata = { title: 'Karyawan & Absensi' };
export default async function HRPage({ searchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccess(session.user.role, "/hr")) redirect("/dashboard");
  const paging = await pageQuery(searchParams),
    query = await searchParams,
    tab = currentTab("/hr", query?.tab, session.user.role);
  if (tab === "scan" || tab === "kartu") return <BarcodeTab tab={tab} query={query} user={session.user} />;
  let filterDate = "";
  try {
    if (query?.date) filterDate = date(query.date).toISOString().slice(0, 10);
  } catch {}
  const filterSource = ["SCAN", "MANUAL"].includes(query?.source) ? query.source : "";
  // Status aktif karyawan mengikuti Master Data Karyawan (E-HSE).
  await ensureFreshEmployees();
  const where = {
    ...(filterDate ? { date: new Date(filterDate + "T00:00:00Z") } : {}),
    ...(filterSource ? { scans: filterSource === "SCAN" ? { some: {} } : { none: {} } } : {}),
  };
  const [employees, rows, total, projects] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, name: true, position: true, nip: true },
      orderBy: { name: "asc" },
      take: 1000,
    }),
    prisma.attendance.findMany({
      where,
      skip: paging.skip,
      take: paging.take,
      include: {
        employee: { select: { name: true, nip: true } },
        project: { select: { name: true } },
        enterUser: { select: { name: true } },
        editUser: { select: { name: true } },
        scans: { select: { scannedAt: true, timeZone: true }, orderBy: { scannedAt: "desc" }, take: 1 },
        _count: { select: { scans: true } },
      },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
    prisma.attendance.count({ where }),
    prisma.project.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      take: 1000,
    }),
  ]);
  const attendances = rows.map((a) => ({
    id: a.id,
    date: a.date.toISOString(),
    employeeName: a.employee.name,
    nip: a.employee.nip,
    projectName: a.project?.name ?? "Absensi lama tanpa proyek",
    status: a.status,
    overtime: a.overtime,
    notes: a.notes,
    enteredBy: a.enterUser.name,
    // Sumber: baris dengan log scan kartu QR = "Scan", selain itu dicatat manual.
    scanCount: a._count.scans,
    lastScan: a.scans[0] ? { at: a.scans[0].scannedAt.toISOString(), timeZone: a.scans[0].timeZone } : null,
    edit: a.editedAt ? { by: a.editUser?.name ?? "-", at: a.editedAt.toISOString(), reason: a.editReason } : null,
  }));
  return (
    <AppLayout
      title="HR & Absensi"
      subtitle={tabLabel("/hr", tab)}
      user={session.user}
    >
      <HRClient
        employees={employees}
        employeeOptions={employees}
        attendances={attendances}
        projects={projects}
        user={session.user}
        filterDate={filterDate}
        filterSource={filterSource}
        canCorrect={ATTENDANCE_HRD_ROLES.includes(session.user.role)}
      />
      <ListPager
        page={paging.page}
        total={total}
        query={{ ...(filterDate ? { date: filterDate } : {}), ...(filterSource ? { source: filterSource } : {}) }}
      />
    </AppLayout>
  );
}

async function BarcodeTab({ tab, query, user }) {
  await ensureFreshEmployees();
  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 1000,
  });
  const projectId = projects.some((p) => p.id === query?.project) ? query.project : "";
  let content;
  if (tab === "scan") {
    let day = localDate(new Date(), DEFAULT_TIMEZONE);
    try {
      if (query?.date) day = date(query.date).toISOString().slice(0, 10);
    } catch {}
    const recap = await scanRecap(day, projectId);
    content = <ScanRecap {...recap} day={day} projectId={projectId} projects={projects} />;
  } else {
    const q = typeof query?.q === "string" ? query.q.trim().slice(0, 100) : "";
    let cards = [], category = "", error = "";
    try {
      ({ cards, category } = await attendanceCards({ projectId, category: query?.category, q }));
    } catch (e) {
      if (!String(e.message).includes("ATTENDANCE_QR_SECRET")) throw e;
      error = e.message;
    }
    content = <QrCards cards={cards} error={error} projectId={projectId} category={category} q={q} projects={projects} />;
  }
  return (
    <AppLayout title="HR & Absensi" subtitle={tabLabel("/hr", tab)} user={user}>
      {content}
    </AppLayout>
  );
}
