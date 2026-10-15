import { prisma } from "../prisma.js";
export async function balances() {
  const [accounts, sums] = await Promise.all([
    prisma.gLAccount.findMany({ orderBy: { accountNo: "asc" }, take: 500 }),
    prisma.journalVoucherItem.groupBy({
      by: ["glAccountId"],
      _sum: { debit: true, credit: true },
    }),
  ]);
  return accounts.map((a) => {
    const s = sums.find((s) => s.glAccountId === a.id)?._sum ?? {},
      debit = Number(s.debit ?? 0),
      credit = Number(s.credit ?? 0),
      creditNormal = [
        "HUTANG",
        "KEWAJIBAN_JANGKA_PANJANG",
        "EKUITAS",
        "PENDAPATAN",
        "PENDAPATAN_LAIN_LAIN",
        "AKUMULASI_PENYUSUTAN",
      ].includes(a.accountType);
    return {
      ...a,
      debit,
      credit,
      currentBalance:
        Number(a.balance) + (creditNormal ? credit - debit : debit - credit),
    };
  });
}
export async function profitability() {
  return prisma.$queryRaw`SELECT p."id", p."code", p."name", COALESCE(SUM(CASE WHEN a."accountType" IN ('PENDAPATAN','PENDAPATAN_LAIN_LAIN') THEN i."credit"-i."debit" ELSE 0 END),0) AS revenue, COALESCE(SUM(CASE WHEN a."accountType" IN ('BEBAN','HARGA_POKOK_PENJUALAN','BEBAN_LAIN_LAIN') THEN i."debit"-i."credit" ELSE 0 END),0) AS cost FROM "Project" p LEFT JOIN "JournalVoucher" j ON j."projectId"=p."id" LEFT JOIN "JournalVoucherItem" i ON i."journalVoucherId"=j."id" LEFT JOIN "GLAccount" a ON a."id"=i."glAccountId" GROUP BY p."id" ORDER BY p."code" LIMIT 1000`;
}
export async function payablesSummary() {
  return prisma.$queryRaw`SELECT COALESCE(SUM("totalAmount"-"paidAmount"),0) AS outstanding, COUNT(*) FILTER (WHERE "dueDate" < CURRENT_DATE AND "paidAmount" < "totalAmount")::int AS overdue FROM "PurchaseInvoice" WHERE "status" <> 'VOID'`;
}
