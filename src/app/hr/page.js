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

export const metadata = { title: 'Karyawan & Absensi' };
export default async function HRPage({ searchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccess(session.user.role, "/hr")) redirect("/dashboard");
  const paging = await pageQuery(searchParams),
    query = await searchParams;
  let filterDate = "";
  try {
    if (query?.date) filterDate = date(query.date).toISOString().slice(0, 10);
  } catch {}
  // Status aktif karyawan mengikuti Master Data Karyawan (E-HSE).
  await ensureFreshEmployees();
  const where = filterDate ? { date: new Date(filterDate + "T00:00:00Z") } : {};
  const [employees, rows, total, projects] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, name: true, position: true },
      orderBy: { name: "asc" },
      take: 1000,
    }),
    prisma.attendance.findMany({
      where,
      skip: paging.skip,
      take: paging.take,
      include: {
        employee: { select: { name: true } },
        project: { select: { name: true } },
        enterUser: { select: { name: true } },
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
    projectName: a.project?.name ?? "Absensi lama tanpa proyek",
    status: a.status,
    overtime: a.overtime,
    enteredBy: a.enterUser.name,
  }));
  return (
    <AppLayout
      title="HR & Absensi"
      subtitle="Kehadiran pegawai per proyek"
      user={session.user}
    >
      <HRClient
        employees={employees}
        employeeOptions={employees}
        attendances={attendances}
        projects={projects}
        user={session.user}
        filterDate={filterDate}
      />
      <ListPager
        page={paging.page}
        total={total}
        query={filterDate ? { date: filterDate } : {}}
      />
    </AppLayout>
  );
}
