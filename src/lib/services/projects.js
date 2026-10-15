import { object, text, money, date, choice, ensure } from "../validation.js";
import { transaction, audit } from "../transactions.js";
import { recalculate } from "./boq.js";
export async function saveProject(body, user, id) {
  object(
    body,
    id
      ? [
          "id",
          "code",
          "name",
          "client",
          "location",
          "contractValue",
          "startDate",
          "endDate",
          "status",
        ]
      : [
          "code",
          "name",
          "client",
          "location",
          "contractValue",
          "startDate",
          "endDate",
        ],
  );
  return transaction(async (tx) => {
    const old = id
      ? await tx.project.findUniqueOrThrow({ where: { id } })
      : null;
    const data = {};
    for (const key of ["code", "name", "client", "location"])
      if (body[key] !== undefined || !id) data[key] = text(body[key], key, 200);
    if (body.contractValue !== undefined || !id)
      data.contractValue = money(body.contractValue, "Kontrak", 0.01);
    for (const key of ["startDate", "endDate"])
      if (body[key] !== undefined || !id) data[key] = date(body[key], key);
    if (body.status !== undefined)
      data.status = choice(body.status, [
        "ACTIVE",
        "ON_HOLD",
        "COMPLETED",
        "ARCHIVED",
      ]);
    ensure(
      (data.startDate ?? old?.startDate) <= (data.endDate ?? old?.endDate),
      "Rentang tanggal terbalik.",
    );
    const result = id
      ? await tx.project.update({ where: { id }, data })
      : await tx.project.create({ data });
    if (id && data.contractValue !== undefined) await recalculate(tx, result);
    await audit(
      tx,
      user,
      "PROJECTS",
      id ? "UPDATE" : "CREATE",
      result.id,
      old,
      result,
    );
    return result;
  });
}
export async function archiveProject(id, user) {
  ensure(user.role === "TOP_MANAGEMENT", "Hanya direktur.", 403);
  return transaction(async (tx) => {
    const old = await tx.project.findUniqueOrThrow({ where: { id } });
    const result = await tx.project.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
    await audit(tx, user, "PROJECTS", "ARCHIVE", id, old, result);
    return { success: true, archived: true };
  });
}
