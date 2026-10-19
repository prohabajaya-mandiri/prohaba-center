import { prisma } from "@/lib/prisma";
import { hseFetch } from "@/lib/hse-client";
import { listQuery } from "@/lib/employee-proxy";
import { canEditEmployees, canSetEmployment, ensureFreshEmployees, legacyEmployees, mirrorList } from "@/lib/services/employees";
import EmployeesClient from "./employees/EmployeesClient";

// Master Data → Karyawan. Data langsung dari E-HSE; bila E-HSE tidak terhubung, tampil salinan ERP (baca saja).
export default async function EmployeesSection({ user, query }) {
  const page = Math.max(1, Math.min(100000, parseInt(query?.page ?? "1", 10) || 1));
  const params = new URLSearchParams(Object.entries(query ?? {}).filter(([, v]) => typeof v === "string"));
  params.set("page", String(page));
  await ensureFreshEmployees();
  const canEdit = canEditEmployees(user);
  let sites = [], data, offline = null;
  try {
    const [siteResult, list] = await Promise.all([hseFetch(user, "/sites"), hseFetch(user, "/personnel?" + listQuery(params))]);
    sites = siteResult.rows;
    data = list;
  } catch (error) {
    offline = error.message;
    data = await mirrorList(query, { skip: (page - 1) * 50, take: 50 });
  }
  const [legacy, last] = await Promise.all([
    canEdit ? legacyEmployees() : [],
    prisma.employee.aggregate({ _max: { syncedAt: true } }),
  ]);
  return (
    <EmployeesClient
      sites={sites}
      rows={data.rows}
      total={data.total}
      page={page}
      canEdit={canEdit}
      canEmployment={canSetEmployment(user)}
      offline={offline}
      legacy={legacy}
      sync={{ at: last._max.syncedAt }}
    />
  );
}
