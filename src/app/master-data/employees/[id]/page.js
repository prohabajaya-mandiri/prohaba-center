import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AppLayout from "@/components/AppLayout";
import { hseFetch, hsePublicUrl } from "@/lib/hse-client";
import { canEditEmployees, canSetEmployment, EMPLOYEE_ROLES, erpAssignments } from "@/lib/services/employees";
import EmployeeDetail from "./EmployeeDetail";

export const metadata = { title: "Detail Karyawan" };

export default async function EmployeeDetailPage({ params }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!EMPLOYEE_ROLES.includes(session.user.role)) redirect("/dashboard");
  const { id } = await params;
  let person;
  try {
    person = await hseFetch(session.user, "/personnel/" + encodeURIComponent(id));
  } catch {
    redirect("/master-data?resource=employees");
  }
  const erp = await erpAssignments(person.id);
  return (
    <AppLayout user={session.user} title={person.name} subtitle={`${person.nip ? `NIP ${person.nip} · ` : ''}${person.position} · ${person.currentSite?.code ?? "-"}`}>
      <EmployeeDetail person={person} erp={erp} hseUrl={hsePublicUrl()} canEdit={canEditEmployees(session.user)} canEmployment={canSetEmployment(session.user)} />
    </AppLayout>
  );
}
