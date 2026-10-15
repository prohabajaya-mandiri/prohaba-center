import { canAccess } from "@/lib/access";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  balances,
  profitability,
  payablesSummary,
} from "@/lib/services/reports";
import AppLayout from "@/components/AppLayout";
import ListPager from "@/components/ListPager";
import { pageQuery } from "@/lib/page-query";
import FinanceClient from "./FinanceClient";
export default async function FinancePage({ searchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccess(session.user.role, "/finance")) redirect("/dashboard");
  const paging = await pageQuery(searchParams);
  const [
    glAccounts,
    profitData,
    summary,
    purchaseInvoices,
    total,
    orders,
    projects,
    vendors,
  ] = await Promise.all([
    balances(),
    profitability(),
    payablesSummary(),
    prisma.purchaseInvoice.findMany({
      skip: paging.skip,
      take: paging.take,
      include: {
        vendor: { select: { name: true } },
        project: { select: { code: true } },
      },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    }),
    prisma.purchaseInvoice.count(),
    prisma.purchaseOrder.findMany({
      where: { status: "DELIVERED" },
      select: { id: true, poNumber: true, totalAmount: true },
      take: 1000,
    }),
    prisma.project.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, code: true, name: true },
      take: 1000,
    }),
    prisma.vendor.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      take: 1000,
    }),
  ]);
  return (
    <AppLayout
      title="Keuangan & Akuntansi"
      subtitle="Saldo jurnal, hutang, pembayaran, dan laba proyek"
      user={session.user}
    >
      <FinanceClient
        glAccounts={glAccounts}
        profitData={profitData}
        summary={summary[0]}
        purchaseInvoices={purchaseInvoices}
        orders={orders}
        projects={projects}
        vendors={vendors}
      />
      <ListPager page={paging.page} total={total} />
    </AppLayout>
  );
}
