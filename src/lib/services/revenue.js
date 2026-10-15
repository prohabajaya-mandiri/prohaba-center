import { Prisma } from "@prisma/client";
import { object, text, money, date, choice, ensure } from "../validation.js";
import { transaction, audit, nextNumber } from "../transactions.js";
import { account, post, receiptData, reverse } from "./ledger.js";
export async function createInvoice(body, user) {
  object(body, [
    "projectId",
    "description",
    "subTotal",
    "taxRate",
    "date",
    "dueDate",
    "category",
    "downPaymentId",
    "downPaymentAmount",
  ]);
  const projectId = text(body.projectId, "Proyek"),
    gross = money(body.subTotal, "Subtotal", 0.01),
    rate = money(body.taxRate, "Pajak"),
    category = choice(body.category, [
      "TERMIN",
      "PROGRESS_BILLING",
      "DP",
      "RETENTION_RELEASE",
    ]);
  ensure(rate <= 100, "Tarif pajak tidak valid.");
  const posted = date(body.date),
    due = body.dueDate ? date(body.dueDate) : null;
  ensure(!due || due >= posted, "Jatuh tempo sebelum tanggal faktur.");
  return transaction(async (tx) => {
    await tx.project.findUniqueOrThrow({
      where: { id: projectId, status: { not: "ARCHIVED" } },
    });
    let applied = new Prisma.Decimal(0),
      dp = null;
    if (body.downPaymentId) {
      ensure(category !== "DP", "Faktur DP tidak boleh memotong DP lain.");
      dp = await tx.salesInvoice.findUniqueOrThrow({
        where: { id: body.downPaymentId },
      });
      ensure(
        dp.projectId === projectId &&
          dp.category === "DP" &&
          dp.status === "PAID" &&
          Number(dp.taxRate) === rate,
        "DP harus lunas dan milik proyek yang sama.",
      );
      const remaining = new Prisma.Decimal(dp.subTotal).minus(dp.dpUsedAmount);
      applied = new Prisma.Decimal(
        body.downPaymentAmount === undefined
          ? remaining
          : money(body.downPaymentAmount, "Potongan DP", 0.01),
      );
      ensure(
        applied.gt(0) && applied.lte(remaining) && applied.lte(gross),
        "Alokasi DP melebihi saldo atau tagihan.",
      );
      await tx.salesInvoice.update({
        where: { id: dp.id },
        data: { dpUsedAmount: { increment: applied } },
      });
    }
    const net = new Prisma.Decimal(gross).minus(applied),
      tax = net.times(rate).div(100).toDecimalPlaces(2),
      total = net.plus(tax),
      ar = await account(tx, "RECEIVABLE"),
      revenue = await account(
        tx,
        category === "DP" ? "CUSTOMER_ADVANCE" : "REVENUE",
      ),
      taxAccount = await account(tx, "TAX_PAYABLE");
    const invoice = await tx.salesInvoice.create({
      data: {
        invoiceNo: await nextNumber(tx, "INV"),
        projectId,
        description: text(body.description, "Uraian", 2000),
        subTotal: net,
        grossSubTotal: gross,
        appliedDownPayment: applied,
        taxRate: rate,
        taxAmount: tax,
        totalAmount: total,
        date: posted,
        dueDate: due,
        category,
        status: total.eq(0) ? "PAID" : "UNPAID",
        downPaymentId: dp?.id ?? null,
      },
    });
    const lines = [
      { glAccountId: ar.id, debit: total, credit: 0 },
      { glAccountId: revenue.id, debit: 0, credit: gross },
      { glAccountId: taxAccount.id, debit: 0, credit: tax },
    ];
    if (applied.gt(0))
      lines.push({
        glAccountId: (await account(tx, "CUSTOMER_ADVANCE")).id,
        debit: applied,
        credit: 0,
      });
    const journal = await post(tx, user, {
      referenceKey: "SALE:" + invoice.id,
      description: "Faktur " + invoice.invoiceNo,
      projectId,
      date: posted,
      lines,
    });
    const result = await tx.salesInvoice.update({
      where: { id: invoice.id },
      data: { journalVoucherId: journal.id },
    });
    await audit(tx, user, "REVENUE", "CREATE", result.id, null, result);
    return result;
  });
}
export async function receivePayment(id, body, user) {
  object(body, ["amount", "payDate", "reference", "bankAccountId"]);
  return transaction(async (tx) => {
    const data = await receiptData(tx, body),
      old = await tx.salesInvoice.findUniqueOrThrow({ where: { id } });
    const existing = await tx.salesReceipt.findUnique({
      where: { reference: data.reference },
    });
    if (existing) {
      ensure(
        existing.invoiceId === id &&
          existing.amount === data.amount &&
          existing.bankAccountId === data.bankAccountId,
        "Referensi sudah digunakan.",
        409,
      );
      return existing;
    }
    ensure(old.status !== "VOID", "Faktur dibatalkan.", 409);
    const remaining = new Prisma.Decimal(old.totalAmount).minus(old.paidAmount);
    ensure(
      new Prisma.Decimal(data.amount).lte(remaining),
      "Pembayaran melebihi sisa tagihan.",
      409,
    );
    const ar = await account(tx, "RECEIVABLE");
    const journal = await post(tx, user, {
      referenceKey: "RECEIPT:" + data.reference,
      description: "Penerimaan " + old.invoiceNo,
      projectId: old.projectId,
      date: data.payDate,
      lines: [
        { glAccountId: data.bankAccountId, debit: data.amount, credit: 0 },
        { glAccountId: ar.id, debit: 0, credit: data.amount },
      ],
    });
    const receipt = await tx.salesReceipt.create({
      data: { ...data, invoiceId: id, journalVoucherId: journal.id },
    });
    const paid = new Prisma.Decimal(old.paidAmount).plus(data.amount);
    await tx.salesInvoice.update({
      where: { id },
      data: {
        paidAmount: paid,
        status: paid.eq(old.totalAmount) ? "PAID" : "PARTIAL",
      },
    });
    await audit(
      tx,
      user,
      "REVENUE",
      "PAYMENT",
      id,
      { paidAmount: old.paidAmount },
      { paidAmount: paid, reference: data.reference },
    );
    return receipt;
  });
}
export async function voidInvoice(id, user) {
  return transaction(async (tx) => {
    const old = await tx.salesInvoice.findUniqueOrThrow({ where: { id } });
    ensure(
      (old.status === "UNPAID" ||
        (old.status === "PAID" && old.totalAmount === 0)) &&
        old.paidAmount === 0 &&
        old.dpUsedAmount === 0,
      "Hanya faktur belum dibayar dan DP belum dialokasikan yang boleh dibatalkan.",
      409,
    );
    ensure(
      old.journalVoucherId,
      "Jurnal legacy harus direkonsiliasi dahulu.",
      409,
    );
    await reverse(tx, user, old.journalVoucherId, old.projectId);
    if (old.downPaymentId)
      await tx.salesInvoice.update({
        where: { id: old.downPaymentId },
        data: { dpUsedAmount: { decrement: old.appliedDownPayment } },
      });
    const result = await tx.salesInvoice.update({
      where: { id },
      data: { status: "VOID" },
    });
    await audit(tx, user, "REVENUE", "VOID", id, old, result);
    return { success: true };
  });
}
