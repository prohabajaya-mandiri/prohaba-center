import * as XLSX from "xlsx";
import { prisma } from "../prisma.js";
import { audit, nextNumber, transaction } from "../transactions.js";
import { array, choice, date, ensure, money, number, object, text } from "../validation.js";
import { analyzeOpname, readOpnameWorkbook } from "../stock-import.js";
import {
  DOC_TYPES, ENTRY_TYPES, HOLDING_LOCATION, averageCost, locationCode, weekRange, weeklyReport,
} from "../stock.js";

// Kartu stok gudang HO (docs/gudang-ho.md). Stok = jumlah StockMovement dari dokumen SELESAI.

const ACTIVE = { document: { status: "SELESAI" } };
const round3 = (n) => Math.round(n * 1000) / 1000;
const key = (itemId, locationId) => itemId + "|" + locationId;

async function balances(db, where = {}) {
  const rows = await db.stockMovement.groupBy({ by: ["itemId", "locationId"], where: { ...ACTIVE, ...where }, _sum: { qty: true } });
  return new Map(rows.map((r) => [key(r.itemId, r.locationId), Number(r._sum.qty ?? 0)]));
}

/** Rata-rata bergerak dihitung ulang dari seluruh kartu stok barang (urut tanggal dokumen). */
async function refreshAverage(tx, itemIds) {
  for (const itemId of new Set(itemIds)) {
    const movements = await tx.stockMovement.findMany({
      where: { itemId, ...ACTIVE },
      select: { qty: true, unitCost: true, document: { select: { type: true } } },
      orderBy: [{ document: { docDate: "asc" } }, { document: { createdAt: "asc" } }],
    });
    const { avgCost } = averageCost(movements.map((m) => ({ ...m, type: m.document.type })));
    await tx.stockItem.update({ where: { id: itemId }, data: { avgCost } });
  }
}

// ─── Baca ───────────────────────────────────────────────────────────────────

export async function stockItems() {
  const [items, stock] = await Promise.all([
    prisma.stockItem.findMany({
      orderBy: [{ groupCode: "asc" }, { sku: "asc" }],
      include: { group: true, homeLocation: { select: { code: true } } },
    }),
    balances(prisma),
  ]);
  const perItem = new Map();
  for (const [k, q] of stock) {
    if (q === 0) continue;
    const [itemId, locationId] = k.split("|");
    perItem.set(itemId, [...(perItem.get(itemId) ?? []), { locationId, qty: q }]);
  }
  return items.map((i) => {
    const locations = perItem.get(i.id) ?? [];
    const q = round3(locations.reduce((s, l) => s + l.qty, 0));
    return { ...i, qty: q, locations, value: Math.round(q * Number(i.avgCost)) };
  });
}

export async function stockItemDetail(sku) {
  const item = await prisma.stockItem.findUnique({ where: { sku }, include: { group: true, homeLocation: true } });
  if (!item) return null;
  const [perLocation, movements] = await Promise.all([
    prisma.stockMovement.groupBy({ by: ["locationId"], where: { itemId: item.id, ...ACTIVE }, _sum: { qty: true } }),
    prisma.stockMovement.findMany({
      where: { itemId: item.id },
      include: {
        location: { select: { code: true } },
        document: { select: { id: true, number: true, type: true, status: true, docDate: true, destination: true, project: { select: { code: true, name: true } } } },
      },
      orderBy: [{ document: { docDate: "desc" } }, { document: { createdAt: "desc" } }],
      take: 300,
    }),
  ]);
  const locations = await prisma.stockLocation.findMany({ where: { id: { in: perLocation.map((p) => p.locationId) } }, select: { id: true, code: true } });
  return {
    item,
    locations: perLocation
      .map((p) => ({ code: locations.find((l) => l.id === p.locationId)?.code, qty: Number(p._sum.qty ?? 0) }))
      .filter((p) => p.qty !== 0)
      .sort((a, b) => a.code.localeCompare(b.code)),
    movements,
  };
}

export async function stockLocations() {
  const [locations, totals] = await Promise.all([
    prisma.stockLocation.findMany({ orderBy: { code: "asc" }, include: { parent: { select: { code: true } } } }),
    balances(prisma),
  ]);
  const count = new Map();
  for (const [k, q] of totals) if (q > 0) count.set(k.split("|")[1], (count.get(k.split("|")[1]) ?? 0) + 1);
  return locations.map((l) => ({ ...l, items: count.get(l.id) ?? 0 }));
}

export async function stockLocationDetail(code) {
  const location = await prisma.stockLocation.findUnique({ where: { code }, include: { parent: true, children: { orderBy: { code: "asc" } } } });
  if (!location) return null;
  const totals = await prisma.stockMovement.groupBy({ by: ["itemId"], where: { locationId: location.id, ...ACTIVE }, _sum: { qty: true } });
  const items = await prisma.stockItem.findMany({ where: { id: { in: totals.map((t) => t.itemId) } } });
  return {
    location,
    items: totals
      .map((t) => ({ ...items.find((i) => i.id === t.itemId), qty: Number(t._sum.qty ?? 0) }))
      .filter((i) => i.qty !== 0)
      .sort((a, b) => a.sku.localeCompare(b.sku)),
  };
}

export async function stockDocuments({ skip, take }, filters = {}) {
  const where = {
    ...(filters.type && filters.type in DOC_TYPES ? { type: filters.type } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.stockDocument.findMany({
      where,
      orderBy: [{ docDate: "desc" }, { createdAt: "desc" }],
      skip,
      take,
      include: {
        project: { select: { code: true, name: true } },
        createdBy: { select: { name: true } },
        _count: { select: { movements: true } },
      },
    }),
    prisma.stockDocument.count({ where }),
  ]);
  return { rows, total };
}

export async function stockDocument(id) {
  ensure(typeof id === "string" && id.length <= 40, "Dokumen tidak valid.");
  const doc = await prisma.stockDocument.findUnique({
    where: { id },
    include: {
      project: { select: { code: true, name: true, location: true } },
      taker: { select: { name: true, nip: true } },
      createdBy: { select: { name: true } },
      movements: {
        orderBy: { id: "asc" },
        include: { item: { select: { sku: true, name: true, spec: true, unit: true } }, location: { select: { code: true } } },
      },
    },
  });
  ensure(doc, "Dokumen tidak ditemukan.", 404);
  return doc;
}

// ─── Master ────────────────────────────────────────────────────────────────

export async function createLocation(body, user) {
  object(body, ["type", "bay", "level", "bin", "zone", "description"]);
  const type = choice(body.type, ["RAK", "BIN", "LANTAI"], "Jenis lokasi");
  const int = (v, name, max) => {
    const n = number(v, name, 1, max);
    ensure(Number.isInteger(n), name + " harus bilangan bulat.");
    return n;
  };
  const spec = { type };
  if (type !== "LANTAI") Object.assign(spec, { bay: int(body.bay, "Nomor bay", 99), level: int(body.level, "Tingkat", 9) });
  if (type === "BIN") spec.bin = int(body.bin, "Nomor bin", 99);
  if (type === "LANTAI") spec.zone = int(body.zone, "Nomor zona", 99);
  const code = locationCode(spec);
  return transaction(async (tx) => {
    let parentId = null;
    if (type === "BIN") {
      const rack = locationCode({ ...spec, type: "RAK" });
      const parent = await tx.stockLocation.upsert({ where: { code: rack }, create: { code: rack, type: "RAK" }, update: {} });
      parentId = parent.id;
    }
    const location = await tx.stockLocation.create({
      data: { code, type, parentId, description: text(body.description, "Keterangan", 200, true) },
    });
    await audit(tx, user, "STOCK", "CREATE", location.id, null, location);
    return location;
  });
}

export async function updateItem(id, body, user) {
  object(body, ["name", "spec", "minStock", "homeLocationId", "isActive"]);
  const data = {};
  if (body.name !== undefined) data.name = text(body.name, "Nama barang", 200);
  if (body.spec !== undefined) data.spec = text(body.spec, "Spesifikasi", 300, true);
  if (body.minStock !== undefined) data.minStock = body.minStock === null || body.minStock === "" ? null : number(body.minStock, "Stok minimum", 0, 1e9);
  if (body.homeLocationId !== undefined) data.homeLocationId = text(body.homeLocationId, "Lokasi utama", 40, true);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  return transaction(async (tx) => {
    const old = await tx.stockItem.findUnique({ where: { id } });
    ensure(old, "Barang tidak ditemukan.", 404);
    const item = await tx.stockItem.update({ where: { id }, data });
    await audit(tx, user, "STOCK", "UPDATE", id, old, item);
    return item;
  });
}

// ─── Transaksi ─────────────────────────────────────────────────────────────

/**
 * Dokumen masuk / keluar / retur / pindah. Barang keluar dinilai dengan harga rata-rata saat itu;
 * stok di lokasi asal tidak boleh minus.
 */
export async function postDocument(body, user) {
  object(body, ["type", "docDate", "projectId", "destination", "takerEmployeeId", "takerName", "vehicleNo", "driverName", "notes", "lines"]);
  const type = choice(body.type, ENTRY_TYPES, "Jenis transaksi");
  const docDate = body.docDate ? date(body.docDate, "Tanggal") : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  ensure(docDate <= new Date(), "Tanggal tidak boleh di masa depan.");
  const projectId = text(body.projectId, "Proyek", 40, true);
  const destination = text(body.destination, type === "MASUK" ? "Asal barang" : "Tujuan", 200, true);
  const takerEmployeeId = text(body.takerEmployeeId, "Pengambil", 40, true);
  const takerName = text(body.takerName, "Nama pengambil", 200, true);
  if (type === "KELUAR") {
    ensure(projectId || destination, "Pilih proyek tujuan atau isi tujuan lain.");
    ensure(takerEmployeeId || takerName, "Pengambil barang wajib diisi.");
  }
  if (type === "RETUR") ensure(projectId, "Pilih proyek asal retur.");
  const lines = array(body.lines, "Daftar barang", 200).map((l, i) => {
    object(l, ["itemId", "locationId", "toLocationId", "qty", "unitCost"]);
    const n = `Baris ${i + 1}: `;
    return {
      itemId: text(l.itemId, n + "barang", 40),
      locationId: text(l.locationId, n + "lokasi", 40),
      toLocationId: type === "PINDAH" ? text(l.toLocationId, n + "lokasi tujuan", 40) : null,
      qty: number(l.qty, n + "jumlah", 0.001, 1e9),
      unitCost: type === "MASUK" ? money(l.unitCost ?? 0, n + "harga satuan") : null,
    };
  });
  for (const l of lines) ensure(type !== "PINDAH" || l.toLocationId !== l.locationId, "Lokasi asal dan tujuan pindah tidak boleh sama.");

  return transaction(async (tx) => {
    const items = new Map(
      (await tx.stockItem.findMany({ where: { id: { in: lines.map((l) => l.itemId) } } })).map((i) => [i.id, i]),
    );
    const locationIds = lines.flatMap((l) => [l.locationId, l.toLocationId]).filter(Boolean);
    const locations = await tx.stockLocation.findMany({ where: { id: { in: locationIds }, isActive: true }, select: { id: true } });
    ensure(locations.length === new Set(locationIds).size, "Lokasi tidak ditemukan atau nonaktif.");
    if (projectId) ensure(await tx.project.findUnique({ where: { id: projectId }, select: { id: true } }), "Proyek tidak ditemukan.");

    const movements = [];
    const outgoing = new Map();
    for (const l of lines) {
      const item = items.get(l.itemId);
      ensure(item?.isActive, "Barang tidak ditemukan atau nonaktif.");
      ensure(item.decimals || Number.isInteger(l.qty), `${item.name}: jumlah harus bulat (${item.unit}).`);
      const avg = Number(item.avgCost);
      if (type === "MASUK") movements.push({ itemId: l.itemId, locationId: l.locationId, qty: l.qty, unitCost: l.unitCost });
      if (type === "RETUR") movements.push({ itemId: l.itemId, locationId: l.locationId, qty: l.qty, unitCost: avg });
      if (type === "KELUAR" || type === "PINDAH") {
        movements.push({ itemId: l.itemId, locationId: l.locationId, qty: -l.qty, unitCost: avg });
        outgoing.set(key(l.itemId, l.locationId), round3((outgoing.get(key(l.itemId, l.locationId)) ?? 0) + l.qty));
      }
      if (type === "PINDAH") movements.push({ itemId: l.itemId, locationId: l.toLocationId, qty: l.qty, unitCost: avg });
    }
    if (outgoing.size) {
      const stock = await balances(tx, { itemId: { in: [...items.keys()] } });
      for (const [k, q] of outgoing) {
        const [itemId] = k.split("|");
        const have = stock.get(k) ?? 0;
        ensure(have >= q, `${items.get(itemId).name}: stok di lokasi itu ${have}, diminta ${q}.`);
      }
    }
    const doc = await tx.stockDocument.create({
      data: {
        number: await nextNumber(tx, DOC_TYPES[type].prefix),
        type,
        docDate,
        projectId: type === "MASUK" || type === "PINDAH" ? null : projectId,
        destination,
        takerEmployeeId,
        takerName,
        vehicleNo: text(body.vehicleNo, "Nomor kendaraan", 40, true),
        driverName: text(body.driverName, "Sopir", 100, true),
        notes: text(body.notes, "Catatan", 500, true),
        createdById: user.id,
        movements: { create: movements },
      },
    });
    await refreshAverage(tx, [...items.keys()]);
    await audit(tx, user, "STOCK", "CREATE", doc.id, null, { number: doc.number, type, lines });
    return doc;
  });
}

/** Membatalkan dokumen (Top Management): dokumen tetap tersimpan tetapi tidak dihitung di stok. */
export async function cancelDocument(id, body, user) {
  object(body, ["reason"]);
  ensure(user.role === "TOP_MANAGEMENT", "Pembatalan hanya oleh Top Management.", 403);
  const reason = text(body.reason, "Alasan", 300);
  return transaction(async (tx) => {
    const doc = await tx.stockDocument.findUnique({ where: { id }, include: { movements: true } });
    ensure(doc, "Dokumen tidak ditemukan.", 404);
    ensure(doc.status === "SELESAI", "Dokumen sudah dibatalkan.");
    ensure(doc.type !== "SALDO_AWAL", "Saldo awal tidak bisa dibatalkan.");
    await tx.stockDocument.update({ where: { id }, data: { status: "DIBATALKAN", cancelReason: reason, cancelledAt: new Date(), cancelledById: user.id } });
    const itemIds = doc.movements.map((m) => m.itemId);
    const stock = await balances(tx, { itemId: { in: itemIds } });
    for (const m of doc.movements)
      ensure((stock.get(key(m.itemId, m.locationId)) ?? 0) >= 0, "Pembatalan membuat stok minus; barangnya sudah keluar lagi.");
    await refreshAverage(tx, itemIds);
    await audit(tx, user, "STOCK", "CANCEL", id, { status: doc.status }, { status: "DIBATALKAN", reason });
    return { ok: true };
  });
}

// ─── Import saldo awal ─────────────────────────────────────────────────────

export async function importOpname(buffer, mode, docDateValue, user) {
  const { sheetName, rows } = readOpnameWorkbook(buffer);
  const { items, blocked, summary } = analyzeOpname(rows);
  const existing = await prisma.stockDocument.findFirst({ where: { type: "SALDO_AWAL", status: "SELESAI" }, select: { number: true } });
  const preview = {
    sheetName,
    summary,
    alreadyImported: existing?.number ?? null,
    blocked,
    notes: items.filter((i) => i.warnings.length).map((i) => ({ name: i.name, group: i.group, rows: i.rows, warnings: i.warnings })),
  };
  if (mode !== "commit") return { mode: "preview", ...preview };
  ensure(!existing, `Saldo awal sudah di-import (${existing?.number}).`, 409);
  const docDate = date(docDateValue, "Tanggal saldo awal");

  const created = await prisma.$transaction(
    async (tx) => {
      const holding = await tx.stockLocation.findUnique({ where: { code: HOLDING_LOCATION } });
      ensure(holding, "Lokasi penampung belum ada (migrasi gudang belum dijalankan).");
      // SKU per kelompok melanjutkan nomor terakhir: MTR-ELC-0001, MTR-ELC-0002, …
      const next = {};
      for (const group of new Set(items.map((i) => i.group))) {
        const seq = await tx.documentSequence.findUnique({ where: { key: "SKU-" + group } });
        next[group] = seq?.value ?? 0;
      }
      const data = items.map((it) => ({
        sku: `MTR-${it.group}-${String(++next[it.group]).padStart(4, "0")}`,
        groupCode: it.group,
        name: it.name,
        unit: it.unit,
        decimals: it.decimals,
        avgCost: it.price,
        notes: it.notes,
      }));
      for (const [group, value] of Object.entries(next))
        await tx.documentSequence.upsert({ where: { key: "SKU-" + group }, create: { key: "SKU-" + group, value }, update: { value } });
      const saved = await tx.stockItem.createManyAndReturn({ data, select: { id: true, sku: true } });
      const bySku = new Map(saved.map((s) => [s.sku, s.id]));
      const movements = items
        .map((it, i) => ({ itemId: bySku.get(data[i].sku), locationId: holding.id, qty: it.qty, unitCost: it.price }))
        .filter((m) => m.qty > 0);
      const doc = await tx.stockDocument.create({
        data: {
          number: await nextNumber(tx, DOC_TYPES.SALDO_AWAL.prefix),
          type: "SALDO_AWAL",
          docDate,
          destination: `Opname ${sheetName}`,
          notes: "Import dari laporan opname Excel",
          createdById: user.id,
          movements: { create: movements },
        },
      });
      await audit(tx, user, "STOCK", "IMPORT", doc.id, null, summary);
      return doc;
    },
    { maxWait: 10000, timeout: 60000 },
  );
  return { mode: "commit", ...preview, alreadyImported: created.number, document: created.number };
}

// ─── Laporan mingguan ──────────────────────────────────────────────────────

export async function weeklyStock(day) {
  const range = weekRange(day);
  const [items, movements] = await Promise.all([
    prisma.stockItem.findMany({ orderBy: [{ groupCode: "asc" }, { sku: "asc" }], include: { group: true } }),
    prisma.stockMovement.findMany({
      where: { ...ACTIVE, document: { status: "SELESAI", docDate: { lt: range.end } } },
      select: { itemId: true, qty: true, document: { select: { type: true, docDate: true } } },
    }),
  ]);
  const rows = weeklyReport(
    items.map((i) => ({ id: i.id, sku: i.sku, name: i.name, unit: i.unit, group: i.group.name, groupCode: i.groupCode, avgCost: i.avgCost })),
    movements.map((m) => ({ itemId: m.itemId, qty: m.qty, type: m.document.type, docDate: m.document.docDate })),
    range,
  );
  return { ...range, rows };
}

export async function weeklyStockXlsx(day) {
  const { start, end, rows } = await weeklyStock(day);
  const last = new Date(end.getTime() - 86400000).toISOString().slice(0, 10);
  const aoa = [
    ["LIST STOK MATERIAL GUDANG KANTOR"],
    [`Periode ${start.toISOString().slice(0, 10)} s/d ${last}`],
    ["Kelompok", "SKU", "Nama Barang", "Sat", "Stok minggu lalu", "Masuk", "Keluar", "Stok akhir", "Harga rata-rata", "Nilai"],
    ...rows.map((r) => [r.group, r.sku, r.name, r.unit, r.opening, r.inQty, r.outQty, r.closing, Number(r.avgCost), r.value]),
    [],
    ["JUMLAH TOTAL", "", "", "", "", "", "", "", "", rows.reduce((s, r) => s + r.value, 0)],
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(aoa), "Stok " + last);
  return { data: XLSX.write(book, { type: "buffer", bookType: "xlsx" }), fileName: `Stok Gudang HO ${last}.xlsx` };
}

