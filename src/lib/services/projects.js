import { object, text, money, date, choice, ensure } from "../validation.js";
import { transaction, audit } from "../transactions.js";
import { recalculate } from "./boq.js";
import { hseSites } from "./employees.js";
import { reconcileAssignments } from "./assignments.js";
import { hseConfigured } from "../hse-client.js";

/** Site E-HSE yang dipilih untuk proyek (satu master site). Diperiksa ke E-HSE di luar transaksi database. */
async function siteLink(value) {
  const siteId = text(value, "Site E-HSE", 100);
  const site = (await hseSites()).find((s) => s.id === siteId);
  ensure(site && site.isActive && !site.isHo, "Site E-HSE tidak ditemukan atau tidak aktif.");
  return { hseSiteId: site.id, hseSiteCode: site.code, hseSiteName: site.name };
}

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
          "hseSiteId",
        ]
      : [
          "code",
          "name",
          "client",
          "location",
          "contractValue",
          "startDate",
          "endDate",
          "hseSiteId",
        ],
  );
  if (!id && hseConfigured()) ensure(body.hseSiteId, "Pilih site E-HSE tempat proyek berjalan.");
  const site = body.hseSiteId !== undefined ? await siteLink(body.hseSiteId) : null;
  const saved = await transaction(async (tx) => {
    const old = id
      ? await tx.project.findUniqueOrThrow({ where: { id } })
      : null;
    const data = { ...site };
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
    return { result, old };
  });
  // Tautan site atau status proyek berubah: sesuaikan penugasan karyawan yang ditempatkan di site lama/baru.
  const { result, old } = saved;
  if (result.hseSiteId !== old?.hseSiteId || result.status !== old?.status) {
    const siteIds = [...new Set([result.hseSiteId, old?.hseSiteId].filter(Boolean))];
    await reconcileAssignments({ OR: [{ hseSiteId: { in: siteIds } }, { projects: { some: { projectId: result.id } } }] });
  }
  return result;
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
