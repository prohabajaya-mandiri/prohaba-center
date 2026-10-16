import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listMaster, masterRoles } from "@/lib/services/master";
import { pagination } from "@/lib/validation";
import AppLayout from "@/components/AppLayout";
import MasterClient from "./MasterClient";
import { tabLabel } from "@/lib/module-tabs";

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
  const result = await listMaster(resource, session.user, { skip, take });
  const projects =
    resource === "assignments"
      ? await prisma.project.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, code: true, name: true },
          take: 500,
        })
      : [];
  const employees =
    resource === "assignments"
      ? await prisma.employee.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          take: 1000,
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
