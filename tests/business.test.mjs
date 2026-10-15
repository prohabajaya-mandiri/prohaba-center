import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  object,
  number,
  money,
  date,
  month,
  pagination,
} from "../src/lib/validation.js";
import { curve } from "../src/lib/boq-calculations.js";
import { calculatePayroll } from "../src/lib/payroll-calculations.js";
import {
  consumeLoginAttempt,
  validSession,
} from "../src/lib/login-security.js";
import { privateFile } from "../src/lib/files.js";
import { parseBoq } from "../src/lib/boq-import.js";
test("boundary validation rejects nested writes, invalid dates, money and unbounded queries", () => {
  assert.throws(() =>
    object({ description: "x", project: { update: {} } }, ["description"]),
  );
  for (const input of [NaN, Infinity, "", null, -1])
    assert.throws(() => number(input, "test"));
  assert.throws(() => money(1.001));
  assert.equal(money("100.50"), 100.5);
  assert.throws(() => date("2026-02-30"));
  assert.throws(() => month("2026-13"));
  assert.throws(() => pagination(new URLSearchParams("limit=999999")));
  assert.throws(() => pagination(new URLSearchParams("page=1.5")));
});
test("S curve counts leaves once and carries actual progress forward", () => {
  const result = curve({}, [
    {
      id: "p",
      code: "1",
      weight: 100,
      startMonth: "2026-01",
      endMonth: "2026-03",
    },
    {
      id: "a",
      code: "1.1",
      weight: 60,
      startMonth: "2026-01",
      endMonth: "2026-02",
      actuals: [{ month: "2026-01", progressPct: 50 }],
    },
    {
      id: "b",
      code: "1.2",
      weight: 40,
      startMonth: "2026-02",
      endMonth: "2026-03",
      actuals: [],
    },
  ]);
  assert.equal(result.summary.totalWeight, "100.00");
  assert.equal(result.summary.itemCount, 2);
  assert.deepEqual(result.scurveData, [
    { month: "2026-01", planned: 30, actual: 30 },
    { month: "2026-02", planned: 80, actual: 30 },
    { month: "2026-03", planned: 100, actual: 30 },
  ]);
});
test("payroll uses explicit assignment rates and refuses missing or partial monthly rates", () => {
  const start = new Date("2026-10-01Z"),
    next = new Date("2026-11-01Z"),
    assignment = {
      employee: { id: "e", isActive: true },
      startDate: start,
      payType: "DAILY",
      dailyRate: 100000,
      overtimeRate: 15000,
    };
  const result = calculatePayroll(
    assignment,
    [
      { employeeId: "e", status: "HADIR", date: start, overtime: 2 },
      {
        employeeId: "e",
        status: "IZIN",
        date: new Date("2026-10-02Z"),
        overtime: 0,
      },
    ],
    start,
    next,
  );
  assert.equal(result.workDays, 1);
  assert.equal(result.netSalary.toNumber(), 130000);
  assert.throws(() =>
    calculatePayroll({ ...assignment, overtimeRate: null }, [], start, next),
  );
  assert.throws(() =>
    calculatePayroll(
      {
        ...assignment,
        payType: "MONTHLY",
        monthlyRate: 3000000,
        startDate: new Date("2026-10-02Z"),
      },
      [],
      start,
      next,
    ),
  );
});
test("password reset or deactivation invalidates existing sessions", () => {
  const user = { isActive: true, sessionVersion: 2 };
  assert.equal(validSession({ sessionVersion: 2 }, user), true);
  assert.equal(validSession({ sessionVersion: 1 }, user), false);
  assert.equal(validSession({}, user), false);
  assert.equal(
    validSession({ sessionVersion: 2 }, { ...user, isActive: false }),
    false,
  );
});
test("login throttle persists limits across callers and resets its window", async () => {
  const rows = new Map(),
    db = {
      loginAttempt: {
        upsert: async ({ where, create }) => {
          const row = rows.get(where.key) ?? { ...create, attempts: 0 };
          row.attempts++;
          rows.set(where.key, row);
          return row;
        },
        deleteMany: async () => {},
      },
    };
  for (let i = 0; i < 10; i++)
    assert.equal(await consumeLoginAttempt(db, "a@a.test", "1", 0), true);
  assert.equal(await consumeLoginAttempt(db, "a@a.test", "2", 0), false);
  assert.equal(await consumeLoginAttempt(db, "a@a.test", "1", 900000), true);
});
test("private uploads reject disguised images and oversized files", async () => {
  await assert.rejects(
    privateFile(new File(["<script>x</script>"], "x.png"), true),
  );
  await assert.rejects(privateFile(new File(["x"], "x.html"), true));
  await assert.rejects(
    privateFile({
      size: 4 * 1024 * 1024 + 1,
      name: "x.pdf",
      arrayBuffer: async () => new ArrayBuffer(0),
    }),
  );
  assert.equal(
    (await privateFile(new File(["%PDF-1.4\ntest"], "x.pdf"))).fileName,
    "x.pdf",
  );
});
test("BOQ parser accepts valid spreadsheets and rejects negative prices atomically before writes", () => {
  const make = (price) => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        ["KODE", "URAIAN"],
        ["1", "Pekerjaan", null, 1, "ls", null, null, null, null, price],
      ]),
      "BOQ",
    );
    return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  };
  assert.equal(parseBoq(make(100))[0].totalPrice, 100);
  assert.throws(() => parseBoq(make(-100)));
  assert.throws(() => parseBoq(Buffer.from("broken")));
});
