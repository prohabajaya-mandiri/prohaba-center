import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import {
  object,
  text,
  money,
  month,
  number,
  array,
  ensure,
} from "../validation.js";
import { transaction, audit } from "../transactions.js";
import { isLeaf, curve } from "../boq-calculations.js";
export function boqCode(value) {
  const code = text(value, "Kode", 40).toUpperCase();
  ensure(
    /^[A-Z0-9]+(?:\.[A-Z0-9]+){0,3}$/.test(code),
    "Format kode BOQ tidak valid.",
  );
  return code;
}
export async function recalculate(tx, project) {
  const items = await tx.bOQItem.findMany({
    where: { projectId: project.id },
    orderBy: { code: "asc" },
  });
  ensure(items.length <= 1000, "Maksimum 1000 item BOQ per proyek.");
  items.sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
  const parents = items.filter((i) => !isLeaf(i, items));
  ensure(
    !(await tx.boqActual.count({
      where: { boqItemId: { in: parents.map((i) => i.id) } },
    })),
    "Item dengan realisasi tidak boleh diubah menjadi grup.",
    409,
  );
  const total = items
    .filter((i) => isLeaf(i, items))
    .reduce((sum, i) => sum.plus(i.totalPrice || 0), new Prisma.Decimal(0));
  ensure(
    total.lte(new Prisma.Decimal(project.contractValue).plus(0.01)),
    "Total BOQ detail melebihi nilai kontrak.",
  );
  if (items.length) {
    const rows = items.map((item, index) =>
      Prisma.sql(
        ["(", "::text,", "::int,", "::int,", "::double precision)"],
        item.id,
        index,
        item.code.split(".").length,
        isLeaf(item, items) && Number(project.contractValue) > 0
          ? Number(
              new Prisma.Decimal(item.totalPrice || 0)
                .div(project.contractValue)
                .times(100)
                .toFixed(6),
            )
          : 0,
      ),
    );
    await tx.$executeRaw(
      Prisma.sql(
        [
          'UPDATE "BOQItem" b SET "sortOrder"=v.sort,"level"=v.level,"weight"=v.weight FROM (VALUES ',
          ") v(id,sort,level,weight) WHERE b.id=v.id",
        ],
        Prisma.join(rows),
      ),
    );
  }
}
export async function saveItem(body, user, id) {
  object(
    body,
    id
      ? ["code", "description", "totalPrice"]
      : ["projectId", "code", "description", "totalPrice"],
  );
  const code = boqCode(body.code),
    description = text(body.description, "Uraian", 2000),
    totalPrice = money(body.totalPrice);
  return transaction(async (tx) => {
    const old = id
      ? await tx.bOQItem.findUniqueOrThrow({ where: { id } })
      : null;
    const project = await tx.project.findUniqueOrThrow({
      where: { id: old?.projectId ?? text(body.projectId, "Proyek") },
    });
    if (old && old.code !== code)
      ensure(
        !(await tx.bOQItem.count({
          where: {
            projectId: project.id,
            code: { startsWith: old.code + "." },
          },
        })),
        "Kode grup yang memiliki detail dikunci.",
        409,
      );
    ensure(project.status === "ACTIVE", "Proyek tidak aktif.", 409);
    const result = id
      ? await tx.bOQItem.update({
          where: { id },
          data: { code, description, totalPrice },
        })
      : await tx.bOQItem.create({
          data: { projectId: project.id, code, description, totalPrice },
        });
    await recalculate(tx, project);
    await audit(
      tx,
      user,
      "BOQ",
      id ? "UPDATE" : "CREATE",
      result.id,
      old,
      result,
    );
    return { success: true, item: result, updated: result };
  });
}
export async function deleteItem(id, user) {
  return transaction(async (tx) => {
    const old = await tx.bOQItem.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { actuals: true, progress: true } } },
    });
    ensure(
      !old._count.actuals && !old._count.progress,
      "Item dengan histori realisasi tidak boleh dihapus.",
      409,
    );
    ensure(
      (await tx.bOQItem.count({
        where: {
          projectId: old.projectId,
          code: { startsWith: old.code + "." },
        },
      })) === 0,
      "Hapus detail sebelum grup.",
      409,
    );
    await tx.bOQItem.delete({ where: { id } });
    await recalculate(
      tx,
      await tx.project.findUniqueOrThrow({ where: { id: old.projectId } }),
    );
    await audit(tx, user, "BOQ", "DELETE", id, old, null);
    return { success: true };
  });
}
export async function importItems(projectId, input, user) {
  array(input, "BOQ", 1000);
  const codes = new Set();
  const rows = input.map((item) => {
    const code = boqCode(item.code);
    ensure(!codes.has(code), "Kode BOQ duplikat: " + code);
    codes.add(code);
    return {
      ...item,
      code,
      totalPrice: money(item.totalPrice ?? 0),
      projectId,
    };
  });
  return transaction(async (tx) => {
    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
    });
    ensure(project.status === "ACTIVE", "Proyek tidak aktif.", 409);
    const old = await tx.bOQItem.findMany({
      where: { projectId },
      include: { _count: { select: { actuals: true, progress: true } } },
    });
    const oldByCode = new Map(old.map((i) => [i.code.toUpperCase(), i]));
    const removed = old.filter((i) => !codes.has(i.code.toUpperCase()));
    ensure(
      removed.every((i) => !i._count.actuals && !i._count.progress),
      "Import akan menghapus item dengan histori. Pertahankan kode item tersebut.",
      409,
    );
    await tx.bOQItem.deleteMany({
      where: { id: { in: removed.map((i) => i.id) } },
    });
    const creates = rows
      .filter((row) => !oldByCode.has(row.code))
      .map((row) => ({ ...row, level: row.code.split(".").length }));
    if (creates.length) await tx.bOQItem.createMany({ data: creates });
    const fields = ['code','description','totalPrice','unit','quantity','costMaterial','costLabor','totalMaterial','totalLabor'];
    const types = ['text','text','text','numeric','text','double precision','numeric','numeric','numeric','numeric'];
    const changes = rows.filter(row=>oldByCode.has(row.code)).map(row=>{
      const existing=oldByCode.get(row.code),values=[existing.id,...fields.map(field=>Object.hasOwn(row,field)?row[field]:existing[field])];
      return Prisma.sql(['(', ...types.map((type,index)=>'::'+type+(index===types.length-1?')':','))],...values);
    });
    if(changes.length) await tx.$executeRaw`UPDATE "BOQItem" b SET ${Prisma.raw(fields.map(field=>'"'+field+'"=v."'+field+'"').join(','))} FROM (VALUES ${Prisma.join(changes)}) AS v("id",${Prisma.raw(fields.map(field=>'"'+field+'"').join(','))}) WHERE b."id"=v."id"`;
    await recalculate(tx, project);
    await audit(
      tx,
      user,
      "BOQ",
      "IMPORT",
      projectId,
      { count: old.length },
      { count: rows.length, preserved: rows.length - creates.length },
    );
    return { success: true, count: rows.length };
  });
}
export async function saveSchedule(body, user) {
  object(body, ["updates"]);
  const updates = array(body.updates, "Jadwal", 1000).map((row) => {
    object(row, ["id", "startMonth", "endMonth"]);
    const start = row.startMonth ? month(row.startMonth) : null,
      end = row.endMonth ? month(row.endMonth) : null;
    ensure(
      Boolean(start) === Boolean(end) && (!start || start <= end),
      "Rentang bulan tidak valid.",
    );
    return { id: text(row.id, "Item"), startMonth: start, endMonth: end };
  });
  ensure(
    new Set(updates.map((i) => i.id)).size === updates.length,
    "Item jadwal duplikat.",
  );
  return transaction(async (tx) => {
    const old = await tx.bOQItem.findMany({
      where: { id: { in: updates.map((i) => i.id) } },
    });
    ensure(old.length === updates.length, "Item tidak ditemukan.", 404);
    ensure(
      new Set(old.map((i) => i.projectId)).size === 1,
      "Satu penyimpanan jadwal hanya untuk satu proyek.",
    );
    ensure(
      (await tx.project.findUniqueOrThrow({ where: { id: old[0].projectId } }))
        .status === "ACTIVE",
      "Proyek tidak aktif.",
      409,
    );
    const all = await tx.bOQItem.findMany({
      where: { projectId: old[0].projectId },
    });
    for (const row of updates) {
      const item = old.find((i) => i.id === row.id);
      ensure(isLeaf(item, all), "Hanya detail BOQ yang dijadwalkan.");
    }
    const values=updates.map(row=>Prisma.sql`(${row.id}::text,${row.startMonth}::text,${row.endMonth}::text)`);
    await tx.$executeRaw`UPDATE "BOQItem" b SET "startMonth"=v.start,"endMonth"=v.finish FROM (VALUES ${Prisma.join(values)}) AS v(id,start,finish) WHERE b."id"=v.id`;
    await audit(tx, user, "BOQ", "SCHEDULE", old[0].projectId, null, updates);
    return { success: true, updated: updates.length };
  });
}
export async function saveActual(body, user) {
  object(body, [
    "boqItemId",
    "projectId",
    "month",
    "volumeActual",
    "costActual",
    "progressPct",
    "notes",
  ]);
  const period = month(body.month),
    id = text(body.boqItemId, "BOQ"),
    projectId = text(body.projectId, "Proyek");
  const progressPct = number(body.progressPct, "Progres", 0, 100),
    costActual = money(body.costActual ?? 0),
    volumeActual =
      body.volumeActual == null ? null : number(body.volumeActual, "Volume");
  return transaction(async (tx) => {
    const item = await tx.bOQItem.findUniqueOrThrow({ where: { id } });
    ensure(item.projectId === projectId, "BOQ bukan milik proyek ini.");
    ensure(
      (await tx.project.findUniqueOrThrow({ where: { id: projectId } }))
        .status === "ACTIVE",
      "Proyek tidak aktif.",
      409,
    );
    const items = await tx.bOQItem.findMany({ where: { projectId } });
    ensure(isLeaf(item, items), "Realisasi hanya untuk detail.");
    const sum = await tx.boqActual.aggregate({
      where: { boqItemId: id, month: { not: period } },
      _sum: { progressPct: true },
    });
    ensure(
      (sum._sum.progressPct || 0) + progressPct <= 100.000001,
      "Total realisasi item melebihi 100%.",
    );
    const old = await tx.boqActual.findUnique({
      where: { boqItemId_month: { boqItemId: id, month: period } },
    });
    const data = {
      progressPct,
      costActual,
      volumeActual,
      notes: text(body.notes, "Catatan", 2000, true),
      inputBy: user.id,
    };
    const result = await tx.boqActual.upsert({
      where: { boqItemId_month: { boqItemId: id, month: period } },
      create: { ...data, boqItemId: id, projectId, month: period },
      update: data,
    });
    await audit(tx, user, "BOQ", "ACTUAL", result.id, old, result);
    return result;
  });
}
export async function getCurve(projectId) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
  });
  const items = await prisma.bOQItem.findMany({
    where: { projectId },
    take: 1000,
    orderBy: { sortOrder: "asc" },
    include: { actuals: { orderBy: { month: "asc" } } },
  });
  return curve(project, items);
}
