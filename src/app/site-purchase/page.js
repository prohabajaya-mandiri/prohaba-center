import { canAccess } from "@/lib/access";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppLayout from "@/components/AppLayout";
import ListPager from "@/components/ListPager";
import { pageQuery } from "@/lib/page-query";
import SitePurchaseClient from "./SitePurchaseClient";

export const metadata = { title: 'Pembelian Site' };
export default async function SitePage({ searchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccess(session.user.role, "/site-purchase")) redirect("/dashboard");
  const p = await pageQuery(searchParams);
  const [sitePurchases, total, projects, priceReferences, accounts] =
    await Promise.all([
      prisma.sitePurchase.findMany({
        skip: p.skip,
        take: p.take,
        include: { project: { select: { code: true } } },
        orderBy: { purchaseDate: "desc" },
      }),
      prisma.sitePurchase.count(),
      prisma.project.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, code: true, name: true },
        take: 1000,
      }),
      prisma.priceReference.findMany({
        take: 1000,
        orderBy: { itemCode: "asc" },
      }),
      ["TOP_MANAGEMENT", "FINANCE"].includes(session.user.role)
        ? prisma.gLAccount.findMany({
            where: { accountType: "KAS_BANK", isActive: true },
            select: { id: true, accountNo: true, name: true },
            take: 500,
          })
        : [],
    ]);
  return (
    <AppLayout
      title="Pembelian Site"
      subtitle="Bon, pemeriksaan harga, dan review pembayaran"
      user={session.user}
    >
      <SitePurchaseClient
        sitePurchases={sitePurchases}
        projects={projects}
        priceReferences={priceReferences}
        user={session.user}
        accounts={accounts}
      />
      <ListPager page={p.page} total={total} />
    </AppLayout>
  );
}
