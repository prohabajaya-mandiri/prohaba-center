import { Prisma } from "@prisma/client";
import { ensure, date, text, money } from "../validation.js";
import { nextNumber, audit } from "../transactions.js";
export async function account(tx, purpose) {
  const result = await tx.gLAccount.findUnique({ where: { purpose } });
  ensure(
    result?.isActive,
    "Mapping akun " + purpose + " belum tersedia. Isi Master Data akun.",
    409,
  );
  return result;
}
export async function bank(tx, id) {
  const result = await tx.gLAccount.findUniqueOrThrow({
    where: { id: text(id, "Akun bank") },
  });
  ensure(
    result.isActive && result.accountType === "KAS_BANK",
    "Akun kas/bank tidak valid.",
  );
  return result;
}
export async function post(
  tx,
  user,
  { referenceKey, description, date: postedDate, projectId, lines },
) {
  const debit = lines.reduce(
      (s, l) => s.plus(l.debit || 0),
      new Prisma.Decimal(0),
    ),
    credit = lines.reduce(
      (s, l) => s.plus(l.credit || 0),
      new Prisma.Decimal(0),
    );
  ensure(debit.eq(credit) && debit.gt(0), "Jurnal tidak seimbang atau nol.");
  for (const line of lines) {
    money(Number(line.debit || 0));
    money(Number(line.credit || 0));
    ensure(
      !(Number(line.debit) > 0 && Number(line.credit) > 0),
      "Baris jurnal tidak valid.",
    );
  }
  const result = await tx.journalVoucher.create({
    data: {
      journalNo: await nextNumber(tx, "JV"),
      referenceKey,
      description,
      projectId: projectId || null,
      date: postedDate,
      totalAmount: debit,
      items: { create: lines },
    },
  });
  await audit(tx, user, "JOURNAL", "POST", result.id, null, {
    referenceKey,
    amount: debit,
  });
  return result;
}
export async function reverse(tx, user, id, projectId) {
  const original = await tx.journalVoucher.findUniqueOrThrow({
    where: { id },
    include: { items: true },
  });
  ensure(!original.reversedAt, "Jurnal sudah dibalik.", 409);
  const result = await post(tx, user, {
    referenceKey: "REVERSE:" + id,
    description: "Pembalikan " + original.journalNo,
    projectId,
    date: new Date(),
    lines: original.items.map((l) => ({
      glAccountId: l.glAccountId,
      debit: l.credit,
      credit: l.debit,
    })),
  });
  await tx.journalVoucher.update({
    where: { id },
    data: { reversedAt: new Date() },
  });
  return result;
}
export async function receiptData(tx, body) {
  const amount = money(body.amount, "Pembayaran", 0.01),
    payDate = date(body.payDate),
    reference = text(body.reference, "Referensi pembayaran");
  const cash = await bank(tx, body.bankAccountId);
  return { amount, payDate, reference, bankAccountId: cash.id };
}
export const STANDARD_ACCOUNTS = [
  ["1100-BANK", "Kas/Bank", "KAS_BANK", "CASH_BANK"],
  ["1200-AR", "Piutang usaha", "PIUTANG", "RECEIVABLE"],
  ["1300-TAX", "Pajak masukan", "AKTIVA_LANCAR_LAINNYA", "INPUT_TAX"],
  ["2100-AP", "Hutang usaha", "HUTANG", "PAYABLE"],
  ["2200-TAX", "Pajak keluaran", "HUTANG", "TAX_PAYABLE"],
  ["2300-DP", "Uang muka pelanggan", "HUTANG", "CUSTOMER_ADVANCE"],
  [
    "2400-ACCRUAL",
    "Biaya operasional belum dibayar",
    "HUTANG",
    "OPERATING_ACCRUAL",
  ],
  ["4100-REV", "Pendapatan proyek", "PENDAPATAN", "REVENUE"],
  ["5100-EXP", "Biaya proyek", "BEBAN", "EXPENSE"],
];
