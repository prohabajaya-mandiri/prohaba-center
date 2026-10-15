import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/access";
import { balances, payablesSummary } from "@/lib/services/reports";
import AppLayout from "@/components/AppLayout";
import DashboardClient from "./DashboardClient";
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const financial = canAccess(session.user.role, "/finance");
  const [total, active, projects, finance] = await Promise.all([
    prisma.project.count(),
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.project.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    financial
      ? Promise.all([
          balances(),
          payablesSummary(),
          prisma.salesInvoice.aggregate({
            where: { status: { in: ["UNPAID", "PARTIAL"] } },
            _sum: { totalAmount: true, paidAmount: true },
          }),
        ])
      : null,
  ]);
  const summary = finance
    ? {
        cash: finance[0]
          .filter((a) => a.accountType === "KAS_BANK")
          .reduce((s, a) => s + a.currentBalance, 0),
        payable: finance[1][0].outstanding,
        receivable:
          Number(finance[2]._sum.totalAmount ?? 0) -
          Number(finance[2]._sum.paidAmount ?? 0),
      }
    : null;
  return (
    <AppLayout
      title="Dashboard"
      subtitle="Ringkasan dari data tercatat"
      user={session.user}
    >
      <DashboardClient
        user={session.user}
        total={total}
        active={active}
        projects={projects}
        finance={summary}
      />
    </AppLayout>
  );
}
