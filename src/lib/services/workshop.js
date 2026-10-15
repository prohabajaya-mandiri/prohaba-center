import { prisma } from "../prisma.js";
import { object, text, date, number, choice, ensure } from "../validation.js";
import { transaction, audit, nextNumber } from "../transactions.js";
export async function createOrder(body, user) {
  object(body, ["projectId", "description", "startDate", "endDate"]);
  const data = {
    projectId: text(body.projectId, "Proyek"),
    description: text(body.description, "Uraian", 2000),
    startDate: body.startDate ? date(body.startDate) : null,
    endDate: body.endDate ? date(body.endDate) : null,
  };
  ensure(
    !data.startDate || !data.endDate || data.startDate <= data.endDate,
    "Rentang tanggal terbalik.",
  );
  return transaction(async (tx) => {
    await tx.project.findUniqueOrThrow({
      where: { id: data.projectId, status: "ACTIVE" },
    });
    const result = await tx.fabricationOrder.create({
      data: { ...data, orderNumber: await nextNumber(tx, "WO") },
    });
    await audit(tx, user, "WORKSHOP", "CREATE", result.id, null, result);
    return result;
  });
}
export async function changeOrder(id, body, user) {
  object(body, ["description", "status", "startDate", "endDate"]);
  ensure(Object.keys(body).length > 0, "Tidak ada perubahan.");
  return transaction(async (tx) => {
    const old = await tx.fabricationOrder.findUniqueOrThrow({
      where: { id },
      include: { cuttingLists: true, deliveries: true },
    });
    ensure(!old.deliveries.length, "WO yang sudah dikirim dikunci.", 409);
    const data = {};
    if (body.description !== undefined)
      data.description = text(body.description, "Uraian", 2000);
    for (const field of ["startDate", "endDate"])
      if (body[field] !== undefined)
        data[field] = body[field] ? date(body[field]) : null;
    const start = data.startDate === undefined ? old.startDate : data.startDate,
      end = data.endDate === undefined ? old.endDate : data.endDate;
    ensure(!start || !end || start <= end, "Rentang tanggal terbalik.");
    if (body.status !== undefined) {
      choice(body.status, ["IN_PROGRESS", "COMPLETED"]);
      ensure(
        { PLANNED: "IN_PROGRESS", IN_PROGRESS: "COMPLETED" }[old.status] ===
          body.status,
        "Transisi WO tidak diizinkan.",
        409,
      );
      if (body.status === "COMPLETED")
        ensure(
          old.cuttingLists.length > 0 &&
            old.cuttingLists.every((i) => i.status === "FINISHED"),
          "Semua cutting list harus selesai.",
          409,
        );
      data.status = body.status;
    }
    const result = await tx.fabricationOrder.update({ where: { id }, data });
    await audit(tx, user, "WORKSHOP", "UPDATE", id, old, result);
    return result;
  });
}
export async function deleteOrder(id, user) {
  return transaction(async (tx) => {
    const old = await tx.fabricationOrder.findUniqueOrThrow({
      where: { id },
      include: { deliveries: true },
    });
    ensure(
      old.status === "PLANNED" && !old.deliveries.length,
      "Hanya WO rencana yang boleh dihapus.",
      409,
    );
    await tx.fabricationOrder.delete({ where: { id } });
    await audit(tx, user, "WORKSHOP", "DELETE", id, old, null);
    return { success: true };
  });
}
export async function addCutting(body, user) {
  object(body, [
    "fabricationOrderId",
    "materialName",
    "dimensions",
    "quantity",
  ]);
  const quantity = number(body.quantity, "Jumlah", 1, 100000);
  ensure(Number.isInteger(quantity), "Jumlah harus bulat.");
  return transaction(async (tx) => {
    const order = await tx.fabricationOrder.findUniqueOrThrow({
      where: { id: text(body.fabricationOrderId, "WO") },
    });
    ensure(
      ["PLANNED", "IN_PROGRESS"].includes(order.status),
      "WO dikunci.",
      409,
    );
    const item = await tx.cuttingList.create({
      data: {
        fabricationOrderId: order.id,
        materialName: text(body.materialName, "Material"),
        dimensions: text(body.dimensions, "Dimensi", 200, true),
        quantity,
      },
    });
    await audit(tx, user, "WORKSHOP", "CREATE", item.id, null, item);
    return item;
  });
}
export async function changeCutting(id, body, user, remove = false) {
  object(body, remove ? [] : ["status"]);
  return transaction(async (tx) => {
    const old = await tx.cuttingList.findUniqueOrThrow({
      where: { id },
      include: { fabricationOrder: true },
    });
    ensure(
      ["PLANNED", "IN_PROGRESS"].includes(old.fabricationOrder.status),
      "WO dikunci.",
      409,
    );
    if (remove) {
      ensure(
        old.status === "PENDING",
        "Hanya item pending yang boleh dihapus.",
        409,
      );
      await tx.cuttingList.delete({ where: { id } });
    } else {
      ensure(
        { PENDING: "CUT", CUT: "WELDED", WELDED: "FINISHED" }[old.status] ===
          body.status,
        "Transisi pemotongan tidak valid.",
        409,
      );
      await tx.cuttingList.update({
        where: { id },
        data: { status: body.status },
      });
    }
    await audit(
      tx,
      user,
      "WORKSHOP",
      remove ? "DELETE" : "UPDATE",
      id,
      { status: old.status },
      remove ? null : body,
    );
    return { success: true };
  });
}
export async function shipOrder(body, user) {
  object(body, [
    "fabricationOrderId",
    "driverName",
    "vehicleNumber",
    "deliveryDate",
  ]);
  return transaction(async (tx) => {
    const order = await tx.fabricationOrder.findUniqueOrThrow({
      where: { id: text(body.fabricationOrderId, "WO") },
      include: { deliveries: true },
    });
    ensure(
      order.status === "COMPLETED" && !order.deliveries.length,
      "WO harus selesai dan belum dikirim.",
      409,
    );
    const result = await tx.deliveryTicket.create({
      data: {
        ticketNumber: await nextNumber(tx, "SJ"),
        fabricationOrderId: order.id,
        driverName: text(body.driverName, "Pengemudi"),
        vehicleNumber: text(body.vehicleNumber, "Nomor kendaraan"),
        deliveryDate: date(body.deliveryDate),
      },
    });
    await audit(tx, user, "WORKSHOP", "CREATE", result.id, null, result);
    return result;
  });
}
export async function receiveDelivery(id, body, user) {
  object(body, ["status"]);
  choice(body.status, ["RECEIVED_AT_SITE"]);
  return transaction(async (tx) => {
    const old = await tx.deliveryTicket.findUniqueOrThrow({ where: { id } });
    ensure(old.status === "IN_TRANSIT", "Pengiriman sudah diterima.", 409);
    const result = await tx.deliveryTicket.update({
      where: { id },
      data: { status: body.status },
    });
    if (
      (await tx.deliveryTicket.count({
        where: {
          fabricationOrderId: old.fabricationOrderId,
          status: { not: "RECEIVED_AT_SITE" },
        },
      })) === 0
    )
      await tx.fabricationOrder.update({
        where: { id: old.fabricationOrderId },
        data: { status: "DELIVERED" },
      });
    await audit(tx, user, "WORKSHOP", "UPDATE", id, old, result);
    return result;
  });
}
export async function listOrders(paging) {
  return prisma.fabricationOrder.findMany({
    ...paging,
    include: {
      project: { select: { name: true, code: true } },
      cuttingLists: true,
      deliveries: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
