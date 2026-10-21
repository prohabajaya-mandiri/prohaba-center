import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listMaster, masterRoles } from "@/lib/services/master";
import { ensureFreshEmployees } from "@/lib/services/employees";
import { pagination } from "@/lib/validation";
import AppLayout from "@/components/AppLayout";
import MasterClient from "./MasterClient";
import { tabLabel } from "@/lib/module-tabs";
import EmployeesSection from "./EmployeesSection";

export const metadata = { title: 'Master Data' };
export default async function MasterPage({ searchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const resources = Object.keys(masterRoles).filter((key) =>
    masterRoles[key].includes(session.user.role),
  );
  if (!resources.length) redirect("/dashboard");
  const query = await searchParams,
    resource = resources.includes(query?.resource)
      ? query.resource
      : resources[0],
    { skip, take, page } = pagination(
      new URLSearchParams({ page: query?.page ?? "1" }),
    );
  if (resource === "employees")
    return (
      <AppLayout user={session.user} title="Master Data" subtitle="Karyawan — terintegrasi dengan E-HSE">
        <EmployeesSection key={JSON.stringify(query ?? {})} user={session.user} query={query} />
      </AppLayout>
    );
  const result = await listMaster(resource, session.user, { skip, take });
  const projects =
    resource === "assignments"
      ? await prisma.project.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, code: true, name: true },
          take: 500,
        })
      : [];
  if (resource === "assignments") await ensureFreshEmployees();
  // Hanya karyawan aktif yang sudah tertaut ke Master Data Karyawan (E-HSE) yang dapat ditugaskan.
  const employees =
    resource === "assignments"
      ? await prisma.employee.findMany({
          where: { isActive: true, personnelId: { not: null } },
          select: { id: true, name: true, nip: true },
          orderBy: { name: "asc" },
          take: 2000,
        })
      : [];
  return (
    <AppLayout
      user={session.user}
      title="Master Data"
      subtitle={tabLabel("/master-data", resource)}
    >
      <MasterClient
        key={resource}
        resource={resource}
        resources={resources}
        result={result}
        projects={projects}
        employees={employees}
        page={page}
      />
    </AppLayout>
  );
}
