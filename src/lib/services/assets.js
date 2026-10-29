import { randomUUID } from "node:crypto";
import { prisma } from "../prisma.js";
import { audit } from "../transactions.js";
import { ensure } from "../validation.js";
import { analyzeRegister, readRegisterWorkbook, summarize } from "../asset-import.js";
import { ASSET_CONDITION, PRICE_ROLES, STANDARD_RATES, bookValue, findRegisterCodes } from "../assets.js";

const CHUNK = 2000;
const chunks = (list, size = CHUNK) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
const thisYear = () => new Date().getUTCFullYear();

/** Filter daftar aset dari query string halaman. */
export function assetWhere(params) {
  const where = {};
  const q = params.q?.trim();
  if (q)
    where.OR = ["registerNo", "name", "identifier", "brandSpec", "notes"].map((field) => ({
      [field]: { contains: q.slice(0, 100), mode: "insensitive" },
    }));
  if (params.kategori) where.categoryCode = String(params.kategori);
  if (params.lokasi) where.locationId = String(params.lokasi);
  if (params.kondisi && params.kondisi in ASSET_CONDITION) where.condition = params.kondisi;
  return where;
}

/** Satu baris per pembelian (batchId), terbaru dulu, dengan rentang nomor dan jumlah unit. */
export async function listBatches(where, { skip, take }, role) {
  const [groups, total] = await Promise.all([
    prisma.asset.groupBy({
      by: ["batchId", "categoryCode"],
      where,
      _count: { _all: true },
      _sum: { quantity: true },
      _min: { registerNo: true },
      _max: { registerNo: true, acquiredAt: true },
      orderBy: [{ _max: { acquiredAt: "desc" } }, { batchId: "asc" }],
      skip,
      take,
    }),
    prisma.asset.groupBy({ by: ["batchId"], where }).then((g) => g.length),
  ]);
  const firsts = await prisma.asset.findMany({
    where: { ...where, batchId: { in: groups.map((g) => g.batchId) } },
    distinct: ["batchId"],
    orderBy: [{ batchId: "asc" }, { registerNo: "asc" }],
    include: { location: { select: { name: true } }, endUser: { select: { name: true } } },
  });
  const byBatch = new Map(firsts.map((a) => [a.batchId, a]));
  const showPrice = PRICE_ROLES.includes(role);
  const year = thisYear();
  return {
    total,
    rows: groups.map((g) => {
      const a = byBatch.get(g.batchId);
      const units = g._sum.quantity ?? g._count._all;
      return {
        batchId: g.batchId,
        categoryCode: g.categoryCode,
        registers: g._count._all,
        units,
        firstNo: g._min.registerNo,
        lastNo: g._max.registerNo,
        name: a.name,
        brandSpec: a.brandSpec,
        identifier: a.identifier,
        unit: a.unit,
        condition: a.condition,
        location: a.location.name,
        area: a.area,
        endUser: a.endUser?.name ?? null,
        acquiredAt: a.acquiredAt,
        notes: a.notes,
        ...(showPrice && {
          unitPrice: a.unitPrice,
          depreciationRate: a.depreciationRate,
          bookValue: bookValue({ ...a, quantity: units }, year),
        }),
      };
    }),
  };
}

export async function batchUnits(batchId) {
  ensure(typeof batchId === "string" && batchId.length <= 64, "Kelompok tidak valid.");
  return prisma.asset.findMany({
    where: { batchId },
    orderBy: { registerNo: "asc" },
    take: 5000,
    select: {
      id: true, registerNo: true, quantity: true, identifier: true, condition: true,
      damagedYear: true, area: true, notes: true, location: { select: { name: true } },
    },
  });
}

/** Ringkasan per kategori; nilai buku hanya untuk peran yang boleh melihat harga. */
export async function assetSummary(role) {
  const [categories, counts] = await Promise.all([
    prisma.assetCategory.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.asset.groupBy({ by: ["categoryCode"], _count: { _all: true }, _sum: { quantity: true } }),
  ]);
  const values = new Map();
  if (PRICE_ROLES.includes(role)) {
    const year = thisYear();
    const assets = await prisma.asset.findMany({
      select: { categoryCode: true, unitPrice: true, quantity: true, depreciationRate: true, acquiredAt: true },
    });
    for (const a of assets) values.set(a.categoryCode, (values.get(a.categoryCode) ?? 0) + (bookValue(a, year) ?? 0));
  }
  return categories.map((c) => {
    const n = counts.find((x) => x.categoryCode === c.code);
    return {
      code: c.code,
      name: c.name,
      registers: n?._count._all ?? 0,
      units: n?._sum.quantity ?? 0,
      ...(values.size && { bookValue: Math.round(values.get(c.code) ?? 0) }),
    };
  });
}

async function existingNumbers(numbers) {
  const found = new Map();
  for (const part of chunks(numbers, 5000)) {
    const rows = await prisma.asset.findMany({ where: { registerNo: { in: part } }, select: { registerNo: true, batchId: true } });
    for (const r of rows) found.set(r.registerNo, r.batchId);
  }
  return found;
}

const issue = ({ row, units, status, errors, warnings, existing }) => ({
  sheet: row.sheet,
  rowNumber: row.rowNumber,
  code: row.code,
  name: row.name,
  quantity: row.quantity,
  registers: units.length,
  location: row.location,
  status,
  existing,
  errors,
  warnings,
});

/**
 * Import register Excel admin aset. `preview` hanya memeriksa; `commit` menyimpan baris yang valid
 * (baris ditahan dan nomor yang sudah ada dilewati, jadi file yang sama aman di-import ulang).
 */
export async function importRegister(buffer, mode, user) {
  const { rows, valueYear } = readRegisterWorkbook(buffer);
  const locations = await prisma.assetLocation.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  const parsed = analyzeRegister(rows, { locations, valueYear });
  const existing = await existingNumbers(parsed.flatMap((x) => x.units));
  const result = analyzeRegister(rows, { locations, valueYear, existing: new Set(existing.keys()) });
  const summary = summarize(result);
  const issues = result.filter((x) => x.errors.length || x.warnings.length).map(issue);
  if (mode !== "commit") return { mode: "preview", valueYear, summary, issues };
  ensure(summary.okRows > 0, "Tidak ada baris baru yang valid untuk disimpan.");

  const data = [];
  const maxSeq = {};
  for (const item of result.filter((x) => x.status === "ok")) {
    const { row } = item;
    const batchId = item.units.map((no) => existing.get(no)).find(Boolean) ?? randomUUID();
    for (const registerNo of item.units) {
      const [code] = findRegisterCodes(registerNo);
      maxSeq[code.category] = Math.max(maxSeq[code.category] ?? 0, code.seq);
      if (existing.has(registerNo)) continue;
      data.push({
        registerNo,
        batchId,
        categoryCode: row.sheet,
        name: row.name,
        brandSpec: row.brandSpec,
        identifier: row.identifier,
        quantity: item.quantity,
        unit: row.unit,
        unitPrice: row.unitPrice,
        depreciationClass: row.depreciationClass,
        depreciationRate: row.depreciationRate ?? STANDARD_RATES[row.depreciationClass] ?? null,
        acquiredAt: row.acquiredAt,
        costEstimated: true,
        acquisitionSource: "DATA_AWAL",
        condition: item.condition,
        damagedYear: row.damagedYear,
        locationId: item.location.id,
        notes: row.notes,
        createdById: user.id,
      });
    }
  }

  const saved = await prisma.$transaction(
    async (tx) => {
      let count = 0;
      for (const part of chunks(data)) count += (await tx.asset.createMany({ data: part, skipDuplicates: true })).count;
      // Nomor aset baru melanjutkan nomor tertinggi per kategori.
      for (const [category, seq] of Object.entries(maxSeq)) {
        const key = "ASSET-" + category;
        const current = await tx.documentSequence.findUnique({ where: { key } });
        if (!current) await tx.documentSequence.create({ data: { key, value: seq } });
        else if (current.value < seq) await tx.documentSequence.update({ where: { key }, data: { value: seq } });
      }
      await audit(tx, user, "ASSET", "IMPORT", "register", null, { ...summary, saved: count });
      return count;
    },
    { maxWait: 10000, timeout: 120000 },
  );
  return { mode: "commit", valueYear, summary: { ...summary, saved }, issues };
}
