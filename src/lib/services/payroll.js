import { account, post, receiptData } from "./ledger.js";
import {
  object,
  text,
  month,
  date,
  number,
  choice,
  ensure,
} from "../validation.js";
import { transaction, audit } from "../transactions.js";
import { calculatePayroll } from "../payroll-calculations.js";
import { payrollTransition } from "../payroll-approval.js";
import { Prisma } from "@prisma/client";
export async function generate(body, user) {
  object(body, ["projectId", "period"]);
  const projectId = text(body.projectId, "Proyek"),
    period = month(body.period),
    start = new Date(period + "-01T00:00:00Z"),
    next = new Date(start);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return transaction(async (tx) => {
    await tx.project.findUniqueOrThrow({
      where: { id: projectId, status: "ACTIVE" },
    });
    const assignments = await tx.employeeProject.findMany({
      where: {
        projectId,
        startDate: { lt: next },
        OR: [{ endDate: null }, { endDate: { gte: start } }],
        employee: { isActive: true },
      },
      include: { employee: true },
    });
    ensure(assignments.length > 0, "Tidak ada penugasan aktif.");
    const attendances = await tx.attendance.findMany({
      where: { projectId, date: { gte: start, lt: next } },
    });
    const items = assignments.map((a) =>
      calculatePayroll(a, attendances, start, next),
    );
    const totalAmount = items.reduce(
      (s, i) => s.plus(i.netSalary),
      new Prisma.Decimal(0),
    );
    const result = await tx.payroll.create({
      data: {
        projectId,
        period,
        periodStart: start,
        periodEnd: new Date(next.getTime() - 86400000),
        totalAmount,
        items: { create: items },
      },
      include: { items: true },
    });
    await audit(tx, user, "PAYROLL", "GENERATE", result.id, null, {
      projectId,
      period,
      totalAmount,
    });
    return result;
  });
}
export async function approve(body, user) {
  object(body, ["payrollId", "action"]);
  const id = text(body.payrollId, "Payroll"),
    rule = payrollTransition(user.role, body.action);
  ensure(rule, "Tindakan tidak diizinkan.", 403);
  return transaction(async (tx) => {
    const old = await tx.payroll.findUniqueOrThrow({ where: { id } });
    ensure(old.status === rule.from, "Status payroll sudah berubah.", 409);
    const role =
      body.action === "SUBMIT"
        ? "SUBMIT"
        : body.action === "HRD_APPROVE"
          ? "HRD"
          : body.action === "FINANCE_APPROVE"
            ? "FINANCE"
            : "TOP_MANAGEMENT";
    const result = await tx.payroll.update({
      where: { id },
      data: {
        status: rule.to,
        lockedAt: rule.to === "FINANCE_APPROVED" ? new Date() : old.lockedAt,
      },
    });
    await tx.payrollApproval.create({
      data: {
        payrollId: id,
        approvedBy: user.id,
        role,
        action: body.action === "SUBMIT" ? "SUBMITTED" : "APPROVED",
      },
    });
    await audit(
      tx,
      user,
      "PAYROLL",
      "APPROVE",
      id,
      { status: old.status },
      { status: result.status, action: body.action },
    );
    return result;
  });
}
export async function attendance(body, user) {
  object(body, [
    "date",
    "projectId",
    "employeeId",
    "status",
    "overtime",
    "notes",
  ]);
  const data = {
    date: date(body.date),
    projectId: text(body.projectId, "Proyek"),
    employeeId: text(body.employeeId, "Pegawai"),
    status: choice(body.status, [
      "HADIR",
      "TIDAK_HADIR",
      "IZIN",
      "SAKIT",
      "LIBUR",
    ]),
    overtime: number(body.overtime ?? 0, "Lembur", 0, 24),
    notes: text(body.notes, "Catatan", 2000, true),
  };
  ensure(
    data.status === "HADIR" || data.overtime === 0,
    "Lembur hanya untuk kehadiran.",
  );
  return transaction(async (tx) => {
    // Satu karyawan bisa punya beberapa periode penugasan di proyek yang sama; cari yang mencakup tanggal.
    const assignment = await tx.employeeProject.findFirst({
      where: {
        employeeId: data.employeeId,
        projectId: data.projectId,
        startDate: { lte: data.date },
        OR: [{ endDate: null }, { endDate: { gte: data.date } }],
      },
      include: { employee: true },
    });
    ensure(
      assignment?.employee.isActive,
      "Pegawai tidak ditugaskan pada proyek/tanggal ini.",
    );
    const locked = await tx.payroll.findUnique({
      where: {
        projectId_period: {
          projectId: data.projectId,
          period: data.date.toISOString().slice(0, 7),
        },
      },
    });
    ensure(!locked, "Absensi periode yang sudah dibuat payroll dikunci.", 409);
    const result = await tx.attendance.create({
      data: { ...data, enteredBy: user.id },
    });
    await audit(tx, user, "ATTENDANCE", "CREATE", result.id, null, result);
    return result;
  });
}

export async function payPayroll(id, body, user) {
  object(body, ["amount", "payDate", "reference", "bankAccountId"]);
  ensure(
    ["TOP_MANAGEMENT", "FINANCE"].includes(user.role),
    "Hanya finance/direktur.",
    403,
  );
  return transaction(async (tx) => {
    const data = await receiptData(tx, body),
      old = await tx.payroll.findUniqueOrThrow({ where: { id } });
    const existing = await tx.payrollPayment.findUnique({
      where: { payrollId: id },
    });
    if (existing) {
      ensure(
        existing.reference === data.reference &&
          existing.amount === data.amount &&
          existing.bankAccountId === data.bankAccountId &&
          existing.payDate.getTime() === data.payDate.getTime(),
        "Payroll sudah dibayar.",
        409,
      );
      return existing;
    }
    ensure(
      old.status === "APPROVED" &&
        new Prisma.Decimal(data.amount).eq(old.totalAmount),
      "Payroll harus disetujui dan dibayar sesuai total.",
      409,
    );
    const expense = await account(tx, "EXPENSE");
    const journal = await post(tx, user, {
      referenceKey: "PAYROLL:" + id,
      description: "Payroll " + old.period,
      projectId: old.projectId,
      date: data.payDate,
      lines: [
        { glAccountId: expense.id, debit: data.amount, credit: 0 },
        { glAccountId: data.bankAccountId, debit: 0, credit: data.amount },
      ],
    });
    const result = await tx.payrollPayment.create({
      data: { ...data, payrollId: id, journalVoucherId: journal.id },
    });
    await tx.payroll.update({ where: { id }, data: { status: "PAID" } });
    await audit(
      tx,
      user,
      "PAYROLL",
      "PAYMENT",
      id,
      { status: old.status },
      { status: "PAID", reference: data.reference },
    );
    return result;
  });
}
