import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma.js";
import { canAccess, ROLES } from "../src/lib/access.js";
assert.equal(
  new URL(process.env.DATABASE_URL).searchParams.get("schema"),
  "prohaba_dev",
  "Development only",
);
const base = process.argv[2] ?? "http://localhost:3105",
  tag = "AUDIT-" + randomUUID(),
  password = "Temporary-" + randomUUID(),
  users = [],
  projects = [],
  employees = [],
  vendors = [],
  accountsBefore = (
    await prisma.gLAccount.findMany({ select: { id: true } })
  ).map((a) => a.id),
  checks = [];
function client() {
  const cookies = new Map();
  return async (path, body, method = "POST") => {
    const init = {
      method,
      redirect: "manual",
      headers: {
        origin: base,
        cookie: [...cookies].map(([k, v]) => k + "=" + v).join("; "),
      },
    };
    if (body instanceof URLSearchParams) {
      init.headers["Content-Type"] = "application/x-www-form-urlencoded";
      init.body = body;
    } else if (body instanceof FormData) init.body = body;
    else if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const response = await fetch(base + path, init);
    for (const header of response.headers.getSetCookie()) {
      const entry = header.split(";")[0],
        at = entry.indexOf("=");
      cookies.set(entry.slice(0, at), entry.slice(at + 1));
    }
    return response;
  };
}
async function json(c, path, body, method = "POST", status = 200) {
  const response = await c(path, body, method),
    text = await response.text();
  assert.equal(response.status, status, path + " " + text.slice(0, 180));
  return text ? JSON.parse(text) : null;
}
async function login(user) {
  const c = client(),
    csrf = await json(c, "/api/auth/csrf", undefined, "GET");
  const form = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email: user.email,
    password,
  });
  // Credentials accepts multipart FormData as well as URL-encoded forms.
  await c("/api/auth/callback/credentials", form);
  const session = await json(c, "/api/auth/session", undefined, "GET");
  assert.equal(session?.user?.id, user.id, "Login " + user.role);
  return c;
}
async function mark(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS:", name);
}
try {
  const clients = {};
  for (const role of ROLES) {
    const user = await prisma.user.create({
      data: {
        name: tag + " " + role,
        email:
          tag.toLowerCase() + "-" + role.toLowerCase() + "@example.invalid",
        password: await bcrypt.hash(password, 10),
        role,
      },
    });
    users.push(user);
    clients[role] = await login(user);
  }
  const admin = clients.TOP_MANAGEMENT,
    hr = clients.HRD,
    finance = clients.FINANCE,
    pjo = clients.PJO,
    log = clients.LOGISTIK,
    eng = clients.ENGINEERING,
    workshop = clients.WORKSHOP;
  const makeProject = async (n) => {
    const p = await json(admin, "/api/projects", {
      code: tag + n,
      name: tag + n,
      client: "Test",
      location: "Test",
      contractValue: 10000000,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    projects.push(p.id);
    return p;
  };
  const project = await makeProject("A"),
    other = await makeProject("B");
  if (!process.argv.includes("--skip-matrix"))
    await mark(
      "All seven roles: module access and protected pages",
      async () => {
        for (const role of ROLES) {
          const c = clients[role];
          await Promise.all(
            [
              "/dashboard",
              "/projects",
              "/documents",
              "/finance",
              "/hr",
              "/payroll",
              "/scurve",
              "/master-data",
              "/procurement",
              "/material-request",
              "/site-purchase",
              "/workshop",
              "/logistik",
              "/users",
            ].map(async (path) => {
              const response = await c(path, undefined, "GET");
              assert.equal(
                response.status,
                canAccess(role, path) ? 200 : 403,
                role + " " + path,
              );
            }),
          );
          assert.equal(
            (await c("/api/users", {}, "POST")).status,
            role === "TOP_MANAGEMENT" ? 400 : 403,
          );
        }
      },
    );
  await json(finance, "/api/master/bootstrap", undefined);
  const bank = await prisma.gLAccount.findUniqueOrThrow({
    where: { purpose: "CASH_BANK" },
  });
  const employee = await json(hr, "/api/master/employees", {
    employeeNo: tag,
    name: tag,
    nik: tag.slice(0, 16),
    position: "Teknisi",
    department: "Proyek",
    employeeType: "HARIAN",
    baseSalary: 0,
    joinDate: "2026-01-01",
  });
  employees.push(employee.id);
  await mark(
    "Payroll requires explicit rates, attendance project and staged approval before actual payment",
    async () => {
      const assignment = await prisma.employeeProject.create({
        data: {
          employeeId: employee.id,
          projectId: project.id,
          role: "Teknisi",
          startDate: new Date("2026-01-01Z"),
        },
      });
      await json(
        hr,
        "/api/payroll/generate",
        { projectId: project.id, period: "2026-10" },
        "POST",
        400,
      );
      await json(
        hr,
        "/api/master/assignments/" + assignment.id,
        {
          employeeId: employee.id,
          projectId: project.id,
          role: "Teknisi",
          startDate: "2026-01-01",
          payType: "DAILY",
          dailyRate: 100000,
          overtimeRate: 15000,
        },
        "PUT",
      );
      await json(
        pjo,
        "/api/hr/attendance",
        {
          employeeId: employee.id,
          projectId: other.id,
          date: "2026-10-01",
          status: "HADIR",
        },
        "POST",
        400,
      );
      await json(pjo, "/api/hr/attendance", {
        employeeId: employee.id,
        projectId: project.id,
        date: "2026-10-01",
        status: "HADIR",
        overtime: 2,
      });
      await json(
        pjo,
        "/api/hr/attendance",
        {
          employeeId: employee.id,
          projectId: project.id,
          date: "2026-10-01",
          status: "HADIR",
        },
        "POST",
        409,
      );
      const payroll = await json(hr, "/api/payroll/generate", {
        projectId: project.id,
        period: "2026-10",
      });
      assert.equal(payroll.totalAmount, 130000);
      await json(
        finance,
        "/api/payroll/approve",
        { payrollId: payroll.id, action: "TOP_APPROVE" },
        "POST",
        403,
      );
      for (const [action, c] of [
        ["SUBMIT", hr],
        ["HRD_APPROVE", hr],
        ["FINANCE_APPROVE", finance],
        ["TOP_APPROVE", admin],
      ])
        await json(c, "/api/payroll/approve", {
          payrollId: payroll.id,
          action,
        });
      assert.equal(
        (await prisma.payroll.findUnique({ where: { id: payroll.id } })).status,
        "APPROVED",
      );
      await json(
        pjo,
        "/api/hr/attendance",
        {
          employeeId: employee.id,
          projectId: project.id,
          date: "2026-10-02",
          status: "HADIR",
        },
        "POST",
        409,
      );
      const payment = {
        amount: 130000,
        payDate: "2026-10-15",
        reference: tag + "-PAYROLL",
        bankAccountId: bank.id,
      };
      await json(finance, "/api/payroll/" + payroll.id + "/payments", payment);
      await json(finance, "/api/payroll/" + payroll.id + "/payments", payment);
      assert.equal(
        await prisma.payrollPayment.count({ where: { payrollId: payroll.id } }),
        1,
      );
    },
  );
  await mark(
    "MR approval → PO → bounded receipt → AP invoice → partial and final payment",
    async () => {
      const vendor = await json(log, "/api/master/vendors", {
        code: tag,
        name: tag,
      });
      vendors.push(vendor.id);
      const mr = await json(pjo, "/api/material-request", {
        projectId: project.id,
        priority: "NORMAL",
        items: [{ description: "Besi", quantity: 2, unit: "btg" }],
      });
      await json(
        log,
        "/api/material-request/" + mr.id,
        { status: "APPROVED" },
        "PATCH",
        403,
      );
      await json(
        pjo,
        "/api/material-request/" + mr.id,
        { status: "APPROVED" },
        "PATCH",
      );
      const item = await prisma.mRItem.findFirstOrThrow({
          where: { mrId: mr.id },
        }),
        po = await json(log, "/api/procurement", {
          mrId: mr.id,
          vendorId: vendor.id,
          items: [{ mrItemId: item.id, unitPrice: 50000 }],
        });
      const line = await prisma.pOItem.findFirstOrThrow({
        where: { poId: po.id },
      });
      await json(
        log,
        "/api/procurement/" + po.id + "/receive",
        {
          reference: tag + "-OVER",
          receivedAt: "2026-10-15",
          items: [{ id: line.id, quantity: 3 }],
        },
        "POST",
        400,
      );
      await json(log, "/api/procurement/" + po.id + "/receive", {
        reference: tag + "-RECEIPT",
        receivedAt: "2026-10-15",
        items: [{ id: line.id, quantity: 2 }],
      });
      const invoice = await json(finance, "/api/finance/purchase-invoices", {
        poId: po.id,
        invoiceNo: tag,
        amount: 100000,
        tax: 10000,
        invoiceDate: "2026-10-15",
        dueDate: "2026-10-31",
      });
      const payment = {
        amount: 50000,
        payDate: "2026-10-15",
        reference: tag + "-AP1",
        bankAccountId: bank.id,
      };
      await json(
        finance,
        "/api/finance/purchase-invoices/" + invoice.id + "/payments",
        payment,
      );
      await json(
        finance,
        "/api/finance/purchase-invoices/" + invoice.id + "/payments",
        payment,
      );
      await json(
        finance,
        "/api/finance/purchase-invoices/" + invoice.id + "/payments",
        { ...payment, amount: 60001, reference: tag + "-AP2" },
        "POST",
        409,
      );
      await json(
        finance,
        "/api/finance/purchase-invoices/" + invoice.id + "/payments",
        { ...payment, amount: 60000, reference: tag + "-AP2" },
      );
      assert.equal(
        (await prisma.purchaseInvoice.findUnique({ where: { id: invoice.id } }))
          .status,
        "PAID",
      );
    },
  );
  await mark(
    "Revenue DP is project bound, consumed once, voids preserve reversal and payments are idempotent",
    async () => {
      const body = {
          projectId: project.id,
          description: tag,
          subTotal: 100000,
          taxRate: 0,
          date: "2026-10-15",
          category: "DP",
        },
        dp = await json(finance, "/api/revenue", body),
        payment = {
          amount: 100000,
          payDate: "2026-10-15",
          reference: tag + "-AR",
          bankAccountId: bank.id,
        };
      await json(finance, "/api/revenue/" + dp.id + "/payments", payment);
      await json(finance, "/api/revenue/" + dp.id + "/payments", payment);
      await json(
        finance,
        "/api/revenue",
        {
          ...body,
          projectId: other.id,
          category: "TERMIN",
          downPaymentId: dp.id,
        },
        "POST",
        400,
      );
      const bill = await json(finance, "/api/revenue", {
        ...body,
        category: "TERMIN",
        downPaymentId: dp.id,
      });
      assert.equal(bill.totalAmount, 0);
      await json(
        finance,
        "/api/revenue",
        { ...body, category: "TERMIN", downPaymentId: dp.id },
        "POST",
        400,
      );
      await json(finance, "/api/revenue/" + bill.id, undefined, "DELETE");
      assert.equal(
        (await prisma.salesInvoice.findUnique({ where: { id: dp.id } }))
          .dpUsedAmount,
        0,
      );
      assert.equal(
        (await prisma.salesInvoice.findUnique({ where: { id: bill.id } }))
          .status,
        "VOID",
      );
      await json(
        finance,
        "/api/revenue/" + dp.id,
        { status: "PAID" },
        "PATCH",
        409,
      );
    },
  );
  await mark(
    "Site reference price is server controlled; receipt and reviewed payment are mandatory",
    async () => {
      await json(
        pjo,
        "/api/site-purchase",
        { projectId: project.id, refPrice: 0 },
        "POST",
        400,
      );
      const body = {
          projectId: project.id,
          purchaseDate: "2026-10-15",
          description: "Baut",
          vendor: "Toko",
          quantity: 2,
          unit: "pcs",
          unitPrice: 5000,
        },
        form = new FormData();
      form.set("payload", JSON.stringify(body));
      form.set("file", new File(["%PDF-1.4\ntest"], "receipt.pdf"));
      const row = await json(pjo, "/api/site-purchase", form);
      assert.equal(row.priceFlag, true);
      await json(
        finance,
        "/api/site-purchase/" + row.id,
        { status: "APPROVED", bankAccountId: bank.id },
        "PATCH",
        400,
      );
      await json(
        finance,
        "/api/site-purchase/" + row.id,
        {
          status: "APPROVED",
          bankAccountId: bank.id,
          reviewNotes: "Bukti dan harga diverifikasi",
        },
        "PATCH",
      );
      assert.equal(
        (await fetch(base + "/api/site-purchase/" + row.id + "/receipt"))
          .status,
        401,
      );
      assert.equal(
        (
          await pjo(
            "/api/site-purchase/" + row.id + "/receipt",
            undefined,
            "GET",
          )
        ).status,
        200,
      );
      const page = await pjo("/site-purchase", undefined, "GET");
      assert.ok(
        !(await page.text()).includes("$2b$"),
        "Password hash never serialized",
      );
    },
  );
  await mark(
    "BOQ history survives import, parent totals do not double count, bad inputs roll back",
    async () => {
      const parent = (
        await json(eng, "/api/boq/item", {
          projectId: project.id,
          code: "1",
          description: "Grup",
          totalPrice: 1000,
        })
      ).item;
      const child = (
        await json(eng, "/api/boq/item", {
          projectId: project.id,
          code: "1.1",
          description: "Detail",
          totalPrice: 1000,
        })
      ).item;
      await json(
        eng,
        "/api/boq/schedule",
        {
          updates: [
            { id: child.id, startMonth: "2026-10", endMonth: "2026-11" },
          ],
        },
        "PUT",
      );
      await json(eng, "/api/boq/actual", {
        boqItemId: child.id,
        projectId: project.id,
        month: "2026-10",
        progressPct: 60,
      });
      await json(
        eng,
        "/api/boq/actual",
        {
          boqItemId: child.id,
          projectId: other.id,
          month: "2026-11",
          progressPct: 30,
        },
        "POST",
        400,
      );
      await json(
        eng,
        "/api/boq/actual",
        {
          boqItemId: child.id,
          projectId: project.id,
          month: "2026-11",
          progressPct: 50,
        },
        "POST",
        400,
      );
      await json(eng, "/api/boq/item/" + child.id, undefined, "DELETE", 409);
      await json(eng, "/api/boq/item/" + parent.id, undefined, "DELETE", 409);
      const { importItems } = await import("../src/lib/services/boq.js");
      await importItems(
        project.id,
        [
          { code: "1", description: "Grup", totalPrice: 1000 },
          { code: "1.1", description: "Detail revisi", totalPrice: 1000 },
        ],
        users.find((u) => u.role === "ENGINEERING"),
      );
      assert.equal(
        (await prisma.bOQItem.findUnique({ where: { id: child.id } }))
          .description,
        "Detail revisi",
      );
      assert.equal(
        await prisma.boqActual.count({ where: { boqItemId: child.id } }),
        1,
      );
      await assert.rejects(
        importItems(
          project.id,
          [{ code: "2", description: "Bad replacement", totalPrice: 1 }],
          users[0],
        ),
      );
      assert.ok(await prisma.bOQItem.findUnique({ where: { id: child.id } }));
      const bulk=[{code:'1',description:'Grup',totalPrice:1000},{code:'1.1',description:'Detail',totalPrice:1000},...Array.from({length:998},(_,i)=>({code:'LOAD.'+(i+1),description:'Bulk '+i,totalPrice:1}))];
      await importItems(project.id,bulk,users.find(u=>u.role==='ENGINEERING'));
      await importItems(project.id,bulk.map(row=>({...row,description:row.description+' revised'})),users.find(u=>u.role==='ENGINEERING'));
      const leaves=await prisma.bOQItem.findMany({where:{projectId:project.id,code:{not:'1'}},select:{id:true}});
      await json(eng,'/api/boq/schedule',{updates:leaves.map(row=>({...row,startMonth:'2026-10',endMonth:'2026-11'}))},'PUT');
      assert.equal(await prisma.bOQItem.count({where:{projectId:project.id}}),1000);
      assert.equal(await prisma.boqActual.count({where:{boqItemId:child.id}}),1);
    },
  );
  await mark(
    "Workshop nested privilege escalation blocked and delivery completes only upon receipt",
    async () => {
      const wo = await json(workshop, "/api/workshop/orders", {
        projectId: project.id,
        description: tag,
      });
      await json(
        workshop,
        "/api/workshop/orders/" + wo.id,
        {
          project: {
            update: {
              documents: { updateMany: { data: { role: "TOP_MANAGEMENT" } } },
            },
          },
        },
        "PATCH",
        400,
      );
      const cut = await json(workshop, "/api/workshop/cutting-list", {
        fabricationOrderId: wo.id,
        materialName: "Besi",
        quantity: 1,
      });
      await json(
        workshop,
        "/api/workshop/orders/" + wo.id,
        { status: "IN_PROGRESS" },
        "PATCH",
      );
      for (const status of ["CUT", "WELDED", "FINISHED"])
        await json(
          workshop,
          "/api/workshop/cutting-list/" + cut.id,
          { status },
          "PATCH",
        );
      await json(
        workshop,
        "/api/workshop/orders/" + wo.id,
        { status: "COMPLETED" },
        "PATCH",
      );
      const delivery = await json(workshop, "/api/workshop/deliveries", {
        fabricationOrderId: wo.id,
        driverName: "Test",
        vehicleNumber: "TEST",
        deliveryDate: "2026-10-15",
      });
      assert.equal(
        (await prisma.fabricationOrder.findUnique({ where: { id: wo.id } }))
          .status,
        "COMPLETED",
      );
      await json(
        pjo,
        "/api/workshop/deliveries/" + delivery.id,
        { status: "RECEIVED_AT_SITE" },
        "PATCH",
      );
      assert.equal(
        (await prisma.fabricationOrder.findUnique({ where: { id: wo.id } }))
          .status,
        "DELIVERED",
      );
      const disposable = await json(workshop, "/api/workshop/orders", {
        projectId: project.id,
        description: "Delete test",
      });
      await json(
        workshop,
        "/api/workshop/orders/" + disposable.id,
        undefined,
        "DELETE",
      );
    },
  );
  await mark(
    "Private documents available to workshop, upload/download access checked",
    async () => {
      const form = new FormData();
      for (const [k, v] of Object.entries({
        projectId: project.id,
        title: tag,
        docNumber: tag,
        category: "REPORT",
        targets: '["WORKSHOP"]',
      }))
        form.set(k, v);
      form.set("file", new File(["%PDF-1.4\ntest"], "test.pdf"));
      const doc = await json(eng, "/api/documents", form);
      assert.equal((await workshop(doc.fileUrl, undefined, "GET")).status, 200);
      assert.equal((await fetch(base + doc.fileUrl)).status, 401);
      await json(
        workshop,
        "/api/documents/" + doc.id,
        undefined,
        "DELETE",
        403,
      );
      await json(eng, "/api/documents/" + doc.id, undefined, "DELETE");
    },
  );
  await mark(
    "Unique numbering holds under concurrent requests and PATCH preserves omitted fields",
    async () => {
      const replies = await Promise.all(
        Array.from({ length: 3 }, () =>
          json(workshop, "/api/workshop/orders", {
            projectId: other.id,
            description: tag,
          }),
        ),
      );
      assert.equal(new Set(replies.map((r) => r.orderNumber)).size, 3);
      await json(
        pjo,
        "/api/projects/" + other.id,
        { name: tag + " Changed" },
        "PATCH",
      );
      assert.equal(
        (await prisma.project.findUnique({ where: { id: other.id } }))
          .contractValue,
        10000000,
      );
    },
  );
  await mark(
    "Reset revokes active sessions; PJO HR output excludes sensitive personal data",
    async () => {
      const user = users.find((u) => u.role === "WORKSHOP");
      await json(
        admin,
        "/api/users/" + user.id,
        {
          name: user.name,
          email: user.email,
          role: user.role,
          password: "Replacement-" + randomUUID(),
        },
        "PUT",
      );
      assert.equal(
        (await workshop("/api/documents", undefined, "GET")).status,
        401,
      );
      const response = await pjo("/hr", undefined, "GET"),
        html = await response.text();
      assert.ok(
        !html.includes('"nik"') &&
          !html.includes("bankAccount") &&
          !html.includes('"password"'),
      );
    },
  );
  await mark(
    "Populated pages render payroll, invoices, journals and workshop histories",
    async () => {
      for (const path of [
        "/finance",
        "/payroll",
        "/procurement",
        "/site-purchase",
        "/revenue",
        "/workshop",
        "/hr",
        "/documents",
        "/master-data?resource=assignments",
      ])
        assert.equal((await admin(path, undefined, "GET")).status, 200, path);
      const curve = await json(
        eng,
        "/api/scurve?projectId=" + project.id,
        undefined,
        "GET",
      );
      assert.equal(curve.summary.itemCount, 999);
    },
  );
  await mark(
    "All posted journals balance and audit contains no secrets",
    async () => {
      const journals = await prisma.journalVoucher.findMany({
        where: { projectId: { in: projects } },
        include: { items: true },
      });
      for (const j of journals) {
        assert.equal(
          j.items.reduce((s, i) => s + i.debit, 0),
          j.items.reduce((s, i) => s + i.credit, 0),
        );
      }
      const audits = await prisma.auditLog.findMany({
        where: { userId: { in: users.map((u) => u.id) } },
      });
      assert.ok(audits.length > 20);
      for (const a of audits)
        assert.ok(
          !/\$2[aby]\$|Temporary-|Replacement-/.test(
            (a.oldValue ?? "") + (a.newValue ?? ""),
          ),
        );
    },
  );
  writeFileSync(
    ".vercel/integration-result.json",
    JSON.stringify(
      { at: new Date().toISOString(), checks, passed: checks.length },
      null,
      2,
    ),
  );
} finally {
  const ids = users.map((u) => u.id),
    whereProject = { projectId: { in: projects } };
  await prisma.salesReceipt.deleteMany({
    where: { invoice: { projectId: { in: projects } } },
  });
  await prisma.salesInvoice.updateMany({
    where: whereProject,
    data: { downPaymentId: null },
  });
  await prisma.salesInvoice.deleteMany({ where: whereProject });
  await prisma.purchasePayment.deleteMany({
    where: { purchaseInvoice: whereProject },
  });
  await prisma.purchaseInvoice.deleteMany({ where: whereProject });
  const poIds = (
    await prisma.purchaseOrder.findMany({
      where: whereProject,
      select: { id: true },
    })
  ).map((p) => p.id);
  await prisma.purchaseReceipt.deleteMany({ where: { poId: { in: poIds } } });
  await prisma.pOItem.deleteMany({ where: { poId: { in: poIds } } });
  await prisma.purchaseOrder.deleteMany({ where: whereProject });
  await prisma.mRItem.deleteMany({
    where: { mr: { projectId: { in: projects } } },
  });
  const payrollIds = (
    await prisma.payroll.findMany({ where: whereProject, select: { id: true } })
  ).map((p) => p.id);
  await prisma.payrollPayment.deleteMany({
    where: { payrollId: { in: payrollIds } },
  });
  await prisma.payrollApproval.deleteMany({
    where: { payrollId: { in: payrollIds } },
  });
  await prisma.payrollItem.deleteMany({
    where: { payrollId: { in: payrollIds } },
  });
  await prisma.payroll.deleteMany({ where: whereProject });
  await prisma.attendance.deleteMany({
    where: { employeeId: { in: employees } },
  });
  const siteIds = (
    await prisma.sitePurchase.findMany({
      where: whereProject,
      select: { id: true },
    })
  ).map((p) => p.id);
  await prisma.siteReceipt.deleteMany({
    where: { sitePurchaseId: { in: siteIds } },
  });
  await prisma.purchaseFlag.deleteMany({
    where: { sitePurchaseId: { in: siteIds } },
  });
  await prisma.sitePurchase.deleteMany({ where: whereProject });
  await prisma.journalVoucher.deleteMany({ where: whereProject });
  await prisma.project.deleteMany({ where: { id: { in: projects } } });
  await prisma.employee.deleteMany({ where: { id: { in: employees } } });
  await prisma.vendor.deleteMany({ where: { id: { in: vendors } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.gLAccount.deleteMany({
    where: { id: { notIn: accountsBefore }, journals: { none: {} } },
  });
  for (const user of users)
    await prisma.loginAttempt.deleteMany({
      where: {
        key: {
          startsWith:
            "account:" + createHash("sha256").update(user.email).digest("hex"),
        },
      },
    });
  await prisma.$disconnect();
}
