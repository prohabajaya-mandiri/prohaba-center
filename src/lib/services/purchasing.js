import { Prisma } from "@prisma/client";
import {
  object,
  text,
  money,
  date,
  choice,
  number,
  array,
  ensure,
} from "../validation.js";
import { transaction, audit, nextNumber } from "../transactions.js";
import { account, post, receiptData } from "./ledger.js";
export async function requestMaterial(body, user) {
  object(body, ["projectId", "priority", "notes", "items"]);
  const projectId = text(body.projectId, "Proyek"),
    priority = choice(body.priority ?? "NORMAL", [
      "LOW",
      "NORMAL",
      "HIGH",
      "URGENT",
    ]);
  const items = array(body.items, "Material", 200).map((i) => {
    object(i, ["description", "unit", "quantity"]);
    return {
      description: text(i.description, "Uraian", 500),
      unit: text(i.unit, "Satuan", 30),
      quantity: number(i.quantity, "Jumlah", 0.001, 1e8),
    };
  });
  return transaction(async (tx) => {
    await tx.project.findUniqueOrThrow({
      where: { id: projectId, status: "ACTIVE" },
    });
    const result = await tx.materialRequest.create({
      data: {
        projectId,
        priority,
        notes: text(body.notes, "Catatan", 2000, true),
        requestedBy: user.id,
        mrNumber: await nextNumber(tx, "MR"),
        status: "SUBMITTED",
        items: { create: items },
      },
    });
    await audit(tx, user, "MR", "CREATE", result.id, null, result);
    return result;
  });
}
export async function reviewMaterial(id, body, user) {
  object(body, ["status", "notes"]);
  ensure(
    ["TOP_MANAGEMENT", "PJO"].includes(user.role),
    "Hanya PJO atau direktur menyetujui MR.",
    403,
  );
  const status = choice(body.status, ["APPROVED", "REJECTED"]);
  return transaction(async (tx) => {
    const old = await tx.materialRequest.findUniqueOrThrow({ where: { id } });
    ensure(old.status === "SUBMITTED", "MR sudah diproses.", 409);
    const result = await tx.materialRequest.update({
      where: { id },
      data: {
        status,
        notes: text(body.notes ?? old.notes, "Catatan", 2000, true),
      },
    });
    await audit(tx, user, "MR", "REVIEW", id, old, result);
    return result;
  });
}
export async function createPO(body, user) {
  object(body, ["mrId", "vendorId", "items", "notes"]);
  const prices = array(body.items, "Harga", 200).map((i) => {
    object(i, ["mrItemId", "unitPrice"]);
    return {
      mrItemId: text(i.mrItemId, "Item MR"),
      unitPrice: money(i.unitPrice, "Harga", 0.01),
    };
  });
  ensure(
    new Set(prices.map((i) => i.mrItemId)).size === prices.length,
    "Item duplikat.",
  );
  return transaction(async (tx) => {
    const mr = await tx.materialRequest.findUniqueOrThrow({
      where: { id: text(body.mrId, "MR") },
      include: { items: true },
    });
    ensure(mr.status === "APPROVED", "MR harus disetujui.", 409);
    await tx.vendor.findUniqueOrThrow({
      where: { id: text(body.vendorId, "Vendor"), isActive: true },
    });
    ensure(
      prices.length === mr.items.length,
      "Semua item MR harus diberi harga.",
    );
    const items = mr.items.map((i) => {
      const price = prices.find((p) => p.mrItemId === i.id);
      ensure(price, "Item harga bukan milik MR.");
      return {
        description: i.description,
        unit: i.unit,
        quantity: i.quantity,
        unitPrice: price.unitPrice,
        totalPrice: new Prisma.Decimal(i.quantity)
          .times(price.unitPrice)
          .toDecimalPlaces(2),
      };
    });
    const totalAmount = items.reduce(
      (s, i) => s.plus(i.totalPrice),
      new Prisma.Decimal(0),
    );
    const result = await tx.purchaseOrder.create({
      data: {
        projectId: mr.projectId,
        mrId: mr.id,
        vendorId: body.vendorId,
        poNumber: await nextNumber(tx, "PO"),
        totalAmount,
        notes: text(body.notes, "Catatan", 2000, true),
        items: { create: items },
      },
    });
    await tx.materialRequest.update({
      where: { id: mr.id },
      data: { status: "PO_CREATED" },
    });
    await audit(tx, user, "PROCUREMENT", "CREATE", result.id, null, result);
    return result;
  });
}
export async function receivePO(id, body, user) {
  object(body, ["items", "reference", "receivedAt"]);
  const reference = text(body.reference, "Referensi penerimaan"),
    receivedAt = date(body.receivedAt),
    items = array(body.items, "Penerimaan", 200).map((i) => {
      object(i, ["id", "quantity"]);
      return {
        id: text(i.id, "Item"),
        quantity: number(i.quantity, "Jumlah diterima", 0.001, 1e8),
      };
    });
  ensure(
    new Set(items.map((i) => i.id)).size === items.length,
    "Item penerimaan duplikat.",
  );
  return transaction(async (tx) => {
    const oldReceipt = await tx.purchaseReceipt.findUnique({
      where: { reference },
    });
    if (oldReceipt) {
      ensure(
        oldReceipt.poId === id &&
          JSON.stringify(oldReceipt.items) === JSON.stringify(items),
        "Referensi sudah digunakan.",
        409,
      );
      return oldReceipt;
    }
    const po = await tx.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: { items: true },
    });
    ensure(
      ["CREATED", "SENT", "CONFIRMED", "PARTIAL"].includes(po.status),
      "PO sudah selesai.",
      409,
    );
    for (const row of items) {
      const item = po.items.find((i) => i.id === row.id);
      ensure(
        item && row.quantity + item.deliveredQty <= item.quantity + 1e-8,
        "Penerimaan melebihi pesanan atau item salah.",
      );
      await tx.pOItem.update({
        where: { id: row.id },
        data: { deliveredQty: { increment: row.quantity } },
      });
    }
    const fresh = await tx.pOItem.findMany({ where: { poId: id } });
    const status = fresh.every(
      (i) => Math.abs(i.quantity - i.deliveredQty) < 1e-8,
    )
      ? "DELIVERED"
      : "PARTIAL";
    await tx.purchaseOrder.update({ where: { id }, data: { status } });
    const result = await tx.purchaseReceipt.create({
      data: { poId: id, reference, receivedAt, items },
    });
    await audit(tx, user, "PROCUREMENT", "RECEIVE", id, null, {
      reference,
      items,
      status,
    });
    return result;
  });
}
export async function purchaseInvoice(body, user) {
  object(body, [
    "poId",
    "projectId",
    "vendorId",
    "invoiceNo",
    "invoiceDate",
    "dueDate",
    "amount",
    "tax",
    "notes",
  ]);
  return transaction(async (tx) => {
    const po = body.poId
      ? await tx.purchaseOrder.findUniqueOrThrow({ where: { id: body.poId } })
      : null;
    if (po)
      ensure(po.status === "DELIVERED", "PO harus diterima seluruhnya.", 409);
    const projectId = po?.projectId ?? text(body.projectId, "Proyek"),
      vendorId = po?.vendorId ?? text(body.vendorId, "Vendor");
    await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    await tx.vendor.findUniqueOrThrow({
      where: { id: vendorId, isActive: true },
    });
    const amount = money(body.amount, "Nilai faktur", 0.01),
      tax = money(body.tax ?? 0, "Pajak");
    if (po)
      ensure(
        new Prisma.Decimal(amount).eq(po.totalAmount),
        "Jumlah faktur harus sama dengan PO.",
      );
    const posted = date(body.invoiceDate),
      due = date(body.dueDate);
    ensure(due >= posted, "Jatuh tempo tidak valid.");
    const total = new Prisma.Decimal(amount).plus(tax),
      expense = await account(tx, "EXPENSE"),
      ap = await account(tx, "PAYABLE");
    const result = await tx.purchaseInvoice.create({
      data: {
        poId: po?.id ?? null,
        projectId,
        vendorId,
        invoiceNo: text(body.invoiceNo, "Nomor faktur"),
        invoiceDate: posted,
        dueDate: due,
        amount,
        tax,
        totalAmount: total,
        notes: text(body.notes, "Catatan", 2000, true),
      },
    });
    const lines = [
      { glAccountId: expense.id, debit: amount, credit: 0 },
      { glAccountId: ap.id, debit: 0, credit: total },
    ];
    if (tax > 0)
      lines.push({
        glAccountId: (await account(tx, "INPUT_TAX")).id,
        debit: tax,
        credit: 0,
      });
    const journal = await post(tx, user, {
      referenceKey: "PURCHASE:" + result.id,
      description: "Faktur pembelian " + result.invoiceNo,
      projectId,
      date: posted,
      lines,
    });
    await tx.purchaseInvoice.update({
      where: { id: result.id },
      data: { journalVoucherId: journal.id },
    });
    if (po)
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: "INVOICED" },
      });
    await audit(
      tx,
      user,
      "FINANCE",
      "PURCHASE_INVOICE",
      result.id,
      null,
      result,
    );
    return result;
  });
}
export async function payPurchase(id, body, user) {
  object(body, ["amount", "payDate", "reference", "bankAccountId", "method"]);
  return transaction(async (tx) => {
    const data = await receiptData(tx, body),
      key = "AP:" + data.reference,
      existing = await tx.purchasePayment.findUnique({
        where: { idempotencyKey: key },
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
    const old = await tx.purchaseInvoice.findUniqueOrThrow({ where: { id } });
    const remaining = new Prisma.Decimal(old.totalAmount).minus(old.paidAmount);
    ensure(
      new Prisma.Decimal(data.amount).lte(remaining),
      "Pembayaran melebihi hutang.",
      409,
    );
    const journal = await post(tx, user, {
      referenceKey: key,
      description: "Pembayaran " + old.invoiceNo,
      projectId: old.projectId,
      date: data.payDate,
      lines: [
        {
          glAccountId: (await account(tx, "PAYABLE")).id,
          debit: data.amount,
          credit: 0,
        },
        { glAccountId: data.bankAccountId, debit: 0, credit: data.amount },
      ],
    });
    const result = await tx.purchasePayment.create({
      data: {
        ...data,
        invoiceId: id,
        idempotencyKey: key,
        method: choice(body.method ?? "TRANSFER", ["TRANSFER", "CASH", "GIRO"]),
        journalVoucherId: journal.id,
      },
    });
    const paid = new Prisma.Decimal(old.paidAmount).plus(data.amount);
    await tx.purchaseInvoice.update({
      where: { id },
      data: {
        paidAmount: paid,
        status: paid.eq(old.totalAmount) ? "PAID" : "PARTIAL",
        paidDate: paid.eq(old.totalAmount) ? data.payDate : null,
      },
    });
    await audit(
      tx,
      user,
      "FINANCE",
      "PAYMENT",
      id,
      { paidAmount: old.paidAmount },
      { paidAmount: paid, reference: data.reference },
    );
    return result;
  });
}
export async function sitePurchase(body, user, file = null) {
  object(body, [
    "projectId",
    "purchaseDate",
    "description",
    "vendor",
    "unit",
    "quantity",
    "unitPrice",
    "priceReferenceId",
    "notes",
  ]);
  const quantity = number(body.quantity, "Jumlah", 0.001, 1e8),
    price = money(body.unitPrice, "Harga", 0.01);
  return transaction(async (tx) => {
    await tx.project.findUniqueOrThrow({
      where: { id: text(body.projectId, "Proyek"), status: "ACTIVE" },
    });
    const ref = body.priceReferenceId
      ? await tx.priceReference.findUniqueOrThrow({
          where: { id: body.priceReferenceId },
        })
      : null;
    const unit = text(body.unit, "Satuan", 30);
    ensure(
      !ref || ref.unit.toLowerCase() === unit.toLowerCase(),
      "Satuan tidak sesuai referensi.",
    );
    const flagPct =
      ref && ref.refPrice > 0
        ? ((price - ref.refPrice) / ref.refPrice) * 100
        : null;
    const result = await tx.sitePurchase.create({
      data: {
        projectId: body.projectId,
        purchaseDate: date(body.purchaseDate),
        description: text(body.description, "Uraian", 500),
        vendor: text(body.vendor, "Vendor"),
        unit,
        quantity,
        unitPrice: price,
        totalAmount: new Prisma.Decimal(quantity)
          .times(price)
          .toDecimalPlaces(2),
        refPrice: ref?.refPrice ?? null,
        priceFlag: flagPct == null || flagPct > 10,
        flagPct,
        notes: text(body.notes, "Catatan", 2000, true),
        requestedBy: user.id,
      },
    });
    if (file) {
      await tx.siteReceipt.create({
        data: { sitePurchaseId: result.id, ...file },
      });
      await tx.sitePurchase.update({
        where: { id: result.id },
        data: { receiptUrl: "/api/site-purchase/" + result.id + "/receipt" },
      });
    }
    if (result.priceFlag)
      await tx.purchaseFlag.create({
        data: {
          sitePurchaseId: result.id,
          flaggedBy: user.id,
          reason:
            flagPct == null
              ? "Tanpa referensi harga"
              : "Selisih harga " + flagPct.toFixed(2) + "%",
        },
      });
    await audit(tx, user, "SITE_PURCHASE", "CREATE", result.id, null, result);
    return result;
  });
}
export async function reviewSite(id, body, user) {
  object(body, ["status", "reviewNotes", "bankAccountId"]);
  ensure(
    ["TOP_MANAGEMENT", "FINANCE"].includes(user.role),
    "Hanya finance/direktur.",
    403,
  );
  const status = choice(body.status, ["APPROVED", "REJECTED"]);
  return transaction(async (tx) => {
    const old = await tx.sitePurchase.findUniqueOrThrow({ where: { id } });
    ensure(old.status === "PENDING", "Pembelian sudah diproses.", 409);
    if (status === "APPROVED") {
      ensure(old.receiptUrl, "Bukti pembelian harus dilampirkan.", 409);
      if (old.priceFlag)
        text(body.reviewNotes, "Alasan persetujuan harga", 2000);
      const cash = await tx.gLAccount.findUniqueOrThrow({
        where: {
          id: text(body.bankAccountId, "Kas/bank"),
          accountType: "KAS_BANK",
          isActive: true,
        },
      });
      await post(tx, user, {
        referenceKey: "SITE:" + id,
        description: "Pembelian site " + old.description,
        projectId: old.projectId,
        date: old.purchaseDate,
        lines: [
          {
            glAccountId: (await account(tx, "EXPENSE")).id,
            debit: old.totalAmount,
            credit: 0,
          },
          { glAccountId: cash.id, debit: 0, credit: old.totalAmount },
        ],
      });
    }
    const result = await tx.sitePurchase.update({
      where: { id },
      data: { status, approvedBy: user.id },
    });
    await audit(tx, user, "SITE_PURCHASE", "REVIEW", id, old, {
      ...result,
      reviewNotes: text(body.reviewNotes, "Catatan review", 2000, true),
    });
    return result;
  });
}
