import { Prisma } from "@prisma/client";
import { ensure } from "./validation.js";
export function calculatePayroll(assignment, attendances, start, next) {
  const emp = assignment.employee;
  ensure(emp.isActive, "Pegawai tidak aktif.");
  ensure(
    ["DAILY", "MONTHLY"].includes(assignment.payType) &&
      assignment.overtimeRate != null,
    "Tarif penugasan belum lengkap.",
  );
  const rows = attendances.filter(
    (a) =>
      a.employeeId === emp.id &&
      a.status === "HADIR" &&
      a.date >= assignment.startDate &&
      (!assignment.endDate || a.date <= assignment.endDate),
  );
  const workDays = new Set(rows.map((r) => r.date.toISOString().slice(0, 10)))
      .size,
    overtime = rows.reduce((s, r) => s + r.overtime, 0);
  if (assignment.payType === "MONTHLY")
    ensure(
      assignment.startDate <= start &&
        (!assignment.endDate ||
          assignment.endDate >= new Date(next.getTime() - 86400000)),
      "Tarif bulanan memerlukan penugasan satu periode penuh. Gunakan tarif harian untuk periode parsial.",
    );
  ensure(
    assignment.payType === "DAILY"
      ? assignment.dailyRate != null
      : assignment.monthlyRate != null,
    "Tarif gaji belum diisi.",
  );
  const base = new Prisma.Decimal(
      assignment.payType === "DAILY"
        ? assignment.dailyRate
        : assignment.monthlyRate,
    ).times(assignment.payType === "DAILY" ? workDays : 1),
    extra = new Prisma.Decimal(assignment.overtimeRate).times(overtime);
  return {
    employeeId: emp.id,
    workDays,
    overtime,
    baseSalary: base.toDecimalPlaces(2),
    overtimePay: extra.toDecimalPlaces(2),
    allowances: 0,
    deductions: 0,
    bpjsPay: 0,
    netSalary: base.plus(extra).toDecimalPlaces(2),
  };
}
