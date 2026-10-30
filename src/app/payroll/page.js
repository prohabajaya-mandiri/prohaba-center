import { canAccess } from "@/lib/access";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppLayout from "@/components/AppLayout";
import ListPager from "@/components/ListPager";
import { pageQuery } from "@/lib/page-query";
import { bankAccountMissing } from "@/lib/services/employees";
import PayrollClient from "./PayrollClient";

export const metadata = { title: 'Payroll' };
export default async function PayrollPage({ searchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccess(session.user.role, "/payroll")) redirect("/dashboard");
  const paging = await pageQuery(searchParams);
  const [rows, total, projects, accounts] = await Promise.all([
    prisma.payroll.findMany({
      skip: paging.skip,
      take: paging.take,
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { name: true } },
        items: {
          include: { employee: { select: { name: true, personnelId: true, hasBankAccount: true, bankAccount: true } } },
        },
        approvals: {
          include: { approver: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.payroll.count(),
    prisma.project.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      take: 1000,
    }),
    prisma.gLAccount.findMany({
      where: { accountType: "KAS_BANK", isActive: true },
      select: { id: true, accountNo: true, name: true },
      take: 500,
    }),
  ]);
  // Nomor rekening lama tidak dikirim ke klien; hanya tanda belum diisi.
  const payrolls = rows.map((p) => {
    const items = p.items.map(({ employee, ...i }) => ({ ...i, employeeName: employee.name, bankMissing: bankAccountMissing(employee) }));
    return { ...p, projectName: p.project.name, items, bankMissing: items.filter((i) => i.bankMissing).length };
  });
  return (
    <AppLayout
      title="Payroll"
      subtitle="Absensi → Tarif penugasan → Persetujuan → Pembayaran"
      user={session.user}
    >
      <PayrollClient
        payrolls={payrolls}
        projects={projects}
        accounts={accounts}
        user={session.user}
      />
      <ListPager page={paging.page} total={total} />
    </AppLayout>
  );
}
