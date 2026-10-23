import { prisma } from "../prisma.js";
import { object, text, number, money, choice, array, ensure, InputError } from "../validation.js";
import { transaction, audit, nextNumber } from "../transactions.js";
import { decodeAttendanceQr } from "../attendance-qr.js";
import { scanRoster } from "./attendance-scan.js";
import {
  COUNT_DUE_DAYS,
  DRUM_LITERS,
  FUEL_METHODS,
  LARGE_ISSUE_LITERS,
  MAX_ISSUE_LITERS,
  RECEIPT_TOLERANCE,
  consumption,
  fuelLedger,
  meterRequired,
  meterUnit,
  resolveEntryTime,
  usageStats,
} from "../fuel.js";

const CLIENT_ID = /^[A-Za-z0-9-]{8,64}$/;
const KINDS = ["ISSUE", "RECEIPT", "COUNT", "REQUEST"];
const PHOTO = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/;
const MAX_PHOTO_BYTES = 300 * 1024;
const DAY = 86400000;
const vehicleCard = { id: true, code: true, name: true, type: true, plateNumber: true };

/** Site tempat akun petugas BBM bertugas (diatur di menu Pengguna). */
async function siteOf(user, db = prisma) {
  const account = await db.user.findUnique({
    where: { id: user.id },
    select: { siteProject: { select: { id: true, code: true, name: true, status: true } } },
  });
  const site = account?.siteProject;
  ensure(site, "Akun ini belum ditautkan ke site. Minta admin mengatur site di menu Pengguna.", 409);
  ensure(site.status === "ACTIVE", `Site ${site.name} tidak aktif.`, 409);
  return site;
}

/** Data mentah buku stok satu site (atau semua site bila projectId kosong). */
async function ledgerData(projectId, db = prisma) {
  const where = projectId ? { projectId } : {};
  const [shipments, issues, counts] = await Promise.all([
    db.fuelShipment.findMany({
      where: { ...where, status: "RECEIVED" },
      select: { projectId: true, receivedAt: true, receivedLiters: true, pricePerLiter: true },
    }),
    db.fuelLog.findMany({
      where: { ...where, source: "DRUM", voidedAt: null },
      select: { projectId: true, date: true, liters: true },
    }),
    db.fuelStockCount.findMany({ where, select: { id: true, projectId: true, countedAt: true, totalLiters: true } }),
  ]);
  return {
    receipts: shipments.map((s) => ({ projectId: s.projectId, at: s.receivedAt, liters: s.receivedLiters, price: Number(s.pricePerLiter) })),
    issues: issues.map((i) => ({ projectId: i.projectId, at: i.date, liters: i.liters })),
    counts: counts.map((c) => ({ projectId: c.projectId, id: c.id, at: c.countedAt, totalLiters: c.totalLiters })),
  };
}

// Biaya BBM proyek: rata-rata tertimbang harga per liter dari kiriman yang sudah diterima.
function averagePrice(receipts) {
  const total = receipts.reduce((s, r) => s + r.liters, 0);
  return total ? receipts.reduce((s, r) => s + r.liters * r.price, 0) / total : 0;
}

function siteStock(data, now = new Date()) {
  const ledger = fuelLedger(data);
  return { ...ledger, ...usageStats(data.issues, ledger.stock, now), avgPrice: averagePrice(data.receipts) };
}

// ─── Web petugas BBM (HP, bisa offline) ─────────────────────────────────────

/** Semua yang dibutuhkan HP petugas untuk bekerja offline: site, unit, daftar karyawan, kiriman, stok. */
export async function fuelContext(user) {
  const site = await siteOf(user);
  const [vehicles, recent, shipments, openRequest, data, roster] = await Promise.all([
    prisma.vehicle.findMany({ where: { status: { not: "INACTIVE" } }, select: vehicleCard, orderBy: { name: "asc" }, take: 2000 }),
    // Unit yang sering diisi di site ini tampil paling atas; meter terakhir untuk memeriksa angka mundur.
    prisma.fuelLog.groupBy({
      by: ["vehicleId"],
      where: { projectId: site.id, source: "DRUM", voidedAt: null, date: { gte: new Date(Date.now() - 60 * DAY) } },
      _count: { _all: true },
    }),
    prisma.fuelShipment.findMany({
      where: { projectId: site.id, status: "SENT" },
      select: { id: true, number: true, drums: true, liters: true, sentAt: true, driver: true, plateNumber: true, sealNumbers: true, notes: true },
      orderBy: { sentAt: "asc" },
    }),
    prisma.fuelRequest.findFirst({
      where: { projectId: site.id, status: { in: ["SUBMITTED", "APPROVED"] } },
      select: { number: true, drums: true, status: true, requestedAt: true },
      orderBy: { requestedAt: "desc" },
    }),
    ledgerData(site.id),
    scanRoster(),
  ]);
  const lastMeters = await prisma.$queryRaw`
    SELECT DISTINCT ON ("vehicleId") "vehicleId", "meterValue" FROM "FuelLog"
    WHERE "meterValue" IS NOT NULL AND "voidedAt" IS NULL ORDER BY "vehicleId", "date" DESC`;
  const meter = new Map(lastMeters.map((m) => [m.vehicleId, m.meterValue]));
  const uses = new Map(recent.map((r) => [r.vehicleId, r._count._all]));
  const stock = siteStock(data);
  return {
    site: { id: site.id, code: site.code, name: site.name },
    vehicles: vehicles
      .map((v) => ({ ...v, lastMeter: meter.get(v.id) ?? null, uses: uses.get(v.id) ?? 0 }))
      .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name, "id")),
    employees: roster.employees,
    shipments,
    openRequest,
    stock: { liters: stock.stock, usage: stock.usage, perDay: stock.perDay, daysCover: stock.daysCover, lastCountAt: stock.lastCount?.at ?? null },
    at: new Date(),
  };
}

/**
 * Terima antrean catatan dari HP petugas BBM (langsung atau setelah offline).
 * Setiap catatan diproses sendiri: yang ditolak tidak menggagalkan yang lain, dan
 * catatan dengan clientId yang sudah tersimpan tidak dicatat dua kali.
 */
export async function syncFuel(body, user) {
  object(body, ["sentAt", "entries"]);
  const items = array(body.entries, "Catatan", 50);
  const site = await siteOf(user);
  const now = new Date();
  const parsed = items.map((item) => {
    ensure(item && typeof item === "object", "Catatan tidak valid.");
    const clientId = text(item.clientId, "Id catatan", 64);
    ensure(CLIENT_ID.test(clientId), "Id catatan tidak valid.");
    return { ...item, clientId };
  });
  parsed.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const results = [];
  for (const item of parsed) {
    try {
      const kind = choice(item.kind, KINDS, "Jenis catatan");
      const time = resolveEntryTime(item.at, body.sentAt, now);
      ensure(time.at, time.error);
      const handler = { ISSUE: issueFuel, RECEIPT: receiveShipment, COUNT: countStock, REQUEST: requestDrums }[kind];
      results.push({ clientId: item.clientId, status: "ok", ...(await handler(item, time.at, site, user, now)) });
    } catch (error) {
      if (!(error instanceof InputError)) throw error;
      results.push({ clientId: item.clientId, status: "rejected", message: error.message });
    }
  }
  return { results };
}

async function issueFuel(item, at, site, user, now) {
  object(item, ["clientId", "kind", "at", "vehicleId", "liters", "method", "meterValue", "runHours", "takerCode", "takerName", "notes", "photo"]);
  if (await prisma.fuelLog.findUnique({ where: { clientId: item.clientId }, select: { id: true } })) return {};
  const vehicleId = text(item.vehicleId, "Unit"),
    amount = number(item.liters, "Liter", 0.1, MAX_ISSUE_LITERS),
    method = choice(item.method, Object.keys(FUEL_METHODS), "Cara takar"),
    meterValue = item.meterValue == null || item.meterValue === "" ? null : number(item.meterValue, "HM/km", 0, 1e8),
    runHours = item.runHours == null || item.runHours === "" ? null : number(item.runHours, "Lama nyala", 0.1, 24 * 14),
    notes = text(item.notes, "Catatan", 500, true);
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { ...vehicleCard, status: true } });
  ensure(vehicle && vehicle.status !== "INACTIVE", "Unit tidak ditemukan atau tidak aktif.", 404);
  const unit = meterUnit(vehicle.type);
  if (meterRequired(vehicle.type)) ensure(meterValue != null, `${unit} ${vehicle.name} wajib diisi.`);
  if (vehicle.type === "GENSET") ensure(meterValue != null || runHours != null, `Isi HM atau lama nyala genset ${vehicle.name}.`);

  // Pengambil: kartu QR absensi; tanpa kartu (subkon/tamu) wajib nama.
  let employee = null, takerName = null;
  if (item.takerCode) {
    const employeeNo = decodeAttendanceQr(text(item.takerCode, "Kartu pengambil", 100));
    ensure(employeeNo, "Kartu pengambil tidak sah. Gunakan kartu QR absensi resmi.", 422);
    employee = await prisma.employee.findUnique({ where: { employeeNo }, select: { id: true, name: true, nip: true, isActive: true } });
    ensure(employee, "Karyawan pemilik kartu tidak ditemukan.", 404);
    ensure(employee.isActive, `${employee.name} tidak lagi aktif.`, 409);
  } else takerName = text(item.takerName, "Nama pengambil", 120);

  let photo = null;
  if (item.photo != null) {
    const match = typeof item.photo === "string" ? PHOTO.exec(item.photo) : null;
    ensure(match, "Foto meter tidak valid.");
    photo = Buffer.from(match[1], "base64");
    ensure(photo.length <= MAX_PHOTO_BYTES && photo[0] === 255 && photo[1] === 216 && photo[2] === 255, "Foto meter tidak valid.");
  }

  return transaction(async (tx) => {
    if (meterValue != null) {
      // Antrean offline bisa tiba tidak berurutan, jadi bandingkan dengan meter terdekat sebelum dan sesudahnya.
      const [before, after] = await Promise.all([
        tx.fuelLog.findFirst({ where: { vehicleId, voidedAt: null, meterValue: { not: null }, date: { lt: at } }, orderBy: { date: "desc" }, select: { meterValue: true } }),
        tx.fuelLog.findFirst({ where: { vehicleId, voidedAt: null, meterValue: { not: null }, date: { gt: at } }, orderBy: { date: "asc" }, select: { meterValue: true } }),
      ]);
      ensure(!before || meterValue >= before.meterValue, `${unit} ${vehicle.name} mundur: terakhir ${before?.meterValue}, diisi ${meterValue}. Periksa lagi angkanya.`, 409);
      ensure(!after || meterValue <= after.meterValue, `${unit} ${vehicle.name} lebih besar dari catatan sesudahnya (${after?.meterValue}). Periksa lagi angkanya.`, 409);
    }
    const shipped = await tx.fuelShipment.findMany({ where: { projectId: site.id, status: "RECEIVED" }, select: { receivedLiters: true, pricePerLiter: true } });
    const avgPrice = averagePrice(shipped.map((s) => ({ liters: s.receivedLiters, price: Number(s.pricePerLiter) })));
    const log = await tx.fuelLog.create({
      data: {
        vehicleId,
        projectId: site.id,
        date: at,
        fuelType: "SOLAR",
        liters: amount,
        totalCost: Math.round(amount * avgPrice * 100) / 100,
        meterValue,
        runHours,
        operator: employee?.name ?? takerName,
        notes,
        recordedBy: user.id,
        source: "DRUM",
        clientId: item.clientId,
        method,
        employeeId: employee?.id ?? null,
        takerName,
        receivedAt: now,
        ...(photo ? { photo: { create: { data: photo } } } : {}),
      },
    });
    await audit(tx, user, "FUEL", "ISSUE", log.id, null, { ...log, photo: Boolean(photo) });
    return { vehicle: vehicle.name, taker: employee?.name ?? takerName };
  });
}

async function receiveShipment(item, at, site, user, now) {
  object(item, ["clientId", "kind", "at", "shipmentId", "drums", "liters", "sealIntact", "notes"]);
  const done = await prisma.fuelShipment.findUnique({ where: { receiveClientId: item.clientId }, select: { number: true } });
  if (done) return { number: done.number };
  const shipmentId = text(item.shipmentId, "Kiriman"),
    drums = number(item.drums, "Jumlah drum", 0, 1000),
    received = number(item.liters, "Liter diterima", 0, 1e6),
    notes = text(item.notes, "Catatan", 1000, true);
  ensure(Number.isInteger(drums), "Jumlah drum harus bulat.");
  ensure(typeof item.sealIntact === "boolean", "Pilih kondisi segel.");
  return transaction(async (tx) => {
    const old = await tx.fuelShipment.findUnique({ where: { id: shipmentId } });
    ensure(old && old.projectId === site.id, "Kiriman tidak ditemukan untuk site ini.", 404);
    ensure(old.status === "SENT", `Kiriman ${old.number} sudah ${old.status === "RECEIVED" ? "diterima" : "dibatalkan"}.`, 409);
    ensure(drums <= old.drums && received <= old.liters * 1.02, "Jumlah diterima melebihi yang dikirim HO. Periksa lagi.");
    ensure(at >= old.sentAt, "Waktu terima lebih awal dari waktu kirim.");
    const complete = received >= old.liters * (1 - RECEIPT_TOLERANCE) && drums === old.drums && item.sealIntact;
    ensure(complete || notes, "Jumlah kurang atau segel rusak: tulis keterangan.");
    const result = await tx.fuelShipment.update({
      where: { id: shipmentId },
      data: { status: "RECEIVED", receivedDrums: drums, receivedLiters: received, sealIntact: item.sealIntact, receiveNotes: notes, receivedAt: at, receivedBy: user.id, receiveClientId: item.clientId },
    });
    await audit(tx, user, "FUEL", "RECEIVE", result.id, old, result);
    return { number: result.number, shortage: Math.max(0, Math.round((old.liters - received) * 10) / 10) };
  });
}

async function countStock(item, at, site, user, now) {
  object(item, ["clientId", "kind", "at", "fullDrums", "openLiters", "notes"]);
  if (await prisma.fuelStockCount.findUnique({ where: { clientId: item.clientId }, select: { id: true } })) return {};
  const fullDrums = number(item.fullDrums, "Drum penuh", 0, 2000),
    openLiters = number(item.openLiters, "Isi drum terbuka", 0, 100000);
  ensure(Number.isInteger(fullDrums), "Drum penuh harus bulat.");
  return transaction(async (tx) => {
    const result = await tx.fuelStockCount.create({
      data: {
        clientId: item.clientId,
        projectId: site.id,
        countedAt: at,
        fullDrums,
        openLiters,
        totalLiters: fullDrums * DRUM_LITERS + openLiters,
        notes: text(item.notes, "Catatan", 1000, true),
        countedBy: user.id,
        receivedAt: now,
      },
    });
    await audit(tx, user, "FUEL", "COUNT", result.id, null, result);
    return { totalLiters: result.totalLiters };
  });
}

async function requestDrums(item, at, site, user, now) {
  object(item, ["clientId", "kind", "at", "drums", "notes"]);
  const done = await prisma.fuelRequest.findUnique({ where: { clientId: item.clientId }, select: { number: true } });
  if (done) return { number: done.number };
  const drums = number(item.drums, "Jumlah drum", 1, 500);
  ensure(Number.isInteger(drums), "Jumlah drum harus bulat.");
  return transaction(async (tx) => {
    const open = await tx.fuelRequest.findFirst({ where: { projectId: site.id, status: { in: ["SUBMITTED", "APPROVED"] } }, select: { number: true } });
    ensure(!open, `Pengajuan ${open?.number} masih diproses HO. Tunggu sampai dikirim atau ditolak.`, 409);
    // Angka stok dan pemakaian disalin saat diajukan agar HO menilai dengan data yang sama.
    const stock = siteStock(await ledgerData(site.id, tx), now);
    const result = await tx.fuelRequest.create({
      data: {
        number: await nextNumber(tx, "PBB"),
        clientId: item.clientId,
        projectId: site.id,
        drums,
        notes: text(item.notes, "Catatan", 1000, true),
        requestedBy: user.id,
        requestedAt: at,
        stockLiters: stock.stock,
        usage14d: stock.usage,
        lastCountAt: stock.lastCount?.at ?? null,
      },
    });
    await audit(tx, user, "FUEL", "REQUEST", result.id, null, result);
    return { number: result.number };
  });
}

// ─── Logistik HO ────────────────────────────────────────────────────────────

/** Kirim drum ke site, opsional dari pengajuan yang sudah disetujui. */
export async function createShipment(body, user) {
  object(body, ["projectId", "requestId", "drums", "liters", "pricePerLiter", "driver", "plateNumber", "sealNumbers", "notes"]);
  const drums = number(body.drums, "Jumlah drum", 1, 1000);
  ensure(Number.isInteger(drums), "Jumlah drum harus bulat.");
  const data = {
    projectId: text(body.projectId, "Site"),
    requestId: text(body.requestId, "Pengajuan", 200, true),
    drums,
    liters: number(body.liters, "Total liter", 1, 1e6),
    pricePerLiter: money(body.pricePerLiter, "Harga per liter", 1),
    driver: text(body.driver, "Sopir", 120, true),
    plateNumber: text(body.plateNumber, "Nomor polisi", 40, true),
    sealNumbers: text(body.sealNumbers, "Nomor segel", 1000, true),
    notes: text(body.notes, "Catatan", 1000, true),
  };
  return transaction(async (tx) => {
    await tx.project.findUniqueOrThrow({ where: { id: data.projectId, status: "ACTIVE" } });
    if (data.requestId) {
      const request = await tx.fuelRequest.findUnique({ where: { id: data.requestId } });
      ensure(request && request.projectId === data.projectId, "Pengajuan tidak cocok dengan site.", 404);
      ensure(request.status === "APPROVED", "Pengajuan harus disetujui sebelum dikirim.", 409);
      await tx.fuelRequest.update({ where: { id: request.id }, data: { status: "SHIPPED" } });
    }
    const result = await tx.fuelShipment.create({
      data: { ...data, number: await nextNumber(tx, "KBB"), sentAt: new Date(), createdBy: user.id },
    });
    await audit(tx, user, "FUEL", "SHIP", result.id, null, result);
    return result;
  });
}

export async function cancelShipment(id, body, user) {
  object(body, ["reason"]);
  const reason = text(body.reason, "Alasan", 500);
  return transaction(async (tx) => {
    const old = await tx.fuelShipment.findUniqueOrThrow({ where: { id } });
    ensure(old.status === "SENT", "Hanya kiriman yang belum diterima yang bisa dibatalkan.", 409);
    const result = await tx.fuelShipment.update({ where: { id }, data: { status: "CANCELLED", notes: [old.notes, "Dibatalkan: " + reason].filter(Boolean).join("\n") } });
    if (old.requestId) await tx.fuelRequest.update({ where: { id: old.requestId }, data: { status: "APPROVED" } });
    await audit(tx, user, "FUEL", "CANCEL_SHIPMENT", id, old, result);
    return result;
  });
}

export async function decideRequest(id, body, user) {
  object(body, ["decision", "notes"]);
  const decision = choice(body.decision, ["APPROVED", "REJECTED"], "Keputusan");
  const notes = text(body.notes, "Catatan", 1000, decision === "APPROVED");
  return transaction(async (tx) => {
    const old = await tx.fuelRequest.findUniqueOrThrow({ where: { id } });
    ensure(old.status === "SUBMITTED", "Pengajuan ini sudah diputuskan.", 409);
    const result = await tx.fuelRequest.update({ where: { id }, data: { status: decision, decidedBy: user.id, decidedAt: new Date(), decisionNotes: notes } });
    await audit(tx, user, "FUEL", decision === "APPROVED" ? "APPROVE_REQUEST" : "REJECT_REQUEST", id, old, result);
    return result;
  });
}

/** Batalkan catatan pengambilan yang salah input; tetap tersimpan dan tercatat di audit log, tidak dihitung di stok. */
export async function voidIssue(id, body, user) {
  object(body, ["reason"]);
  const reason = text(body.reason, "Alasan", 500);
  return transaction(async (tx) => {
    const old = await tx.fuelLog.findUniqueOrThrow({ where: { id } });
    ensure(old.source === "DRUM" && !old.voidedAt, "Catatan ini tidak bisa dibatalkan.", 409);
    const result = await tx.fuelLog.update({ where: { id }, data: { voidedAt: new Date(), voidedBy: user.id, voidReason: reason } });
    await audit(tx, user, "FUEL", "VOID_ISSUE", id, old, result);
    return result;
  });
}

export async function issuePhoto(id) {
  const photo = await prisma.fuelPhoto.findUniqueOrThrow({ where: { fuelLogId: id } });
  return new Response(photo.data, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}

/**
 * Ringkasan BBM drum untuk Logistik HO: stok tiap site, pengajuan, kiriman, opname,
 * dan daftar anomali yang perlu diperiksa.
 */
export async function fuelOverview(now = new Date()) {
  const since = new Date(now.getTime() - 90 * DAY);
  const [projects, data, requests, shipments, counts, issues] = await Promise.all([
    prisma.project.findMany({ where: { status: "ACTIVE" }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    ledgerData(null),
    prisma.fuelRequest.findMany({
      orderBy: { requestedAt: "desc" },
      take: 100,
      include: { project: { select: { code: true, name: true } }, requester: { select: { name: true } }, shipment: { select: { number: true } } },
    }),
    prisma.fuelShipment.findMany({
      orderBy: { sentAt: "desc" },
      take: 100,
      include: { project: { select: { code: true, name: true } }, sender: { select: { name: true } }, receiver: { select: { name: true } } },
    }),
    prisma.fuelStockCount.findMany({ select: { id: true, notes: true, fullDrums: true, openLiters: true, counter: { select: { name: true } } } }),
    prisma.fuelLog.findMany({
      where: { source: "DRUM", date: { gte: since } },
      orderBy: { date: "desc" },
      select: {
        id: true, projectId: true, date: true, receivedAt: true, liters: true, method: true, meterValue: true, runHours: true,
        takerName: true, notes: true, voidedAt: true, voidReason: true, totalCost: true,
        vehicle: { select: vehicleCard }, employee: { select: { name: true, nip: true } }, user: { select: { name: true } },
        photo: { select: { fuelLogId: true } },
      },
    }),
  ]);
  const countInfo = new Map(counts.map((c) => [c.id, c]));
  const byProject = (rows) => Map.groupBy(rows, (r) => r.projectId);
  const receipts = byProject(data.receipts), out = byProject(data.issues), stockCounts = byProject(data.counts);
  const projectName = new Map(projects.map((p) => [p.id, p]));
  const anomalies = [];
  const flag = (severity, kind, projectId, at, title, detail, ref) =>
    anomalies.push({ severity, kind, project: projectName.get(projectId)?.code ?? "-", at, title, detail, ref });

  const sites = projects
    .filter((p) => receipts.has(p.id) || out.has(p.id) || stockCounts.has(p.id) || shipments.some((s) => s.projectId === p.id))
    .map((p) => {
      const stock = siteStock({ receipts: receipts.get(p.id) ?? [], issues: out.get(p.id) ?? [], counts: stockCounts.get(p.id) ?? [] }, now);
      const siteIssues = issues.filter((i) => i.projectId === p.id && !i.voidedAt);
      const recent = siteIssues.filter((i) => i.date >= new Date(now.getTime() - 30 * DAY));
      const takers = [...Map.groupBy(recent, (i) => i.employee?.name ?? (i.takerName ? i.takerName + " (tanpa kartu)" : "-"))]
        .map(([name, rows]) => ({ name, liters: rows.reduce((s, r) => s + r.liters, 0), count: rows.length }))
        .sort((a, b) => b.liters - a.liters)
        .slice(0, 8);
      const recentLiters = recent.reduce((s, i) => s + i.liters, 0);
      const estimated = recent.filter((i) => i.method === "PERKIRAAN").reduce((s, i) => s + i.liters, 0);
      const inTransit = shipments.filter((s) => s.projectId === p.id && s.status === "SENT").reduce((s, r) => s + r.liters, 0);
      const countAge = stock.lastCount ? Math.floor((now - stock.lastCount.at) / DAY) : null;
      if (stock.stock < -1) flag("high", "NEGATIVE_STOCK", p.id, now, "Stok sistem minus", `BBM keluar melebihi yang diterima: stok sistem ${stock.stock} L. Ada penerimaan yang belum dicatat atau pengambilan fiktif.`);
      if ((countAge == null && siteIssues.length) || countAge > COUNT_DUE_DAYS)
        flag("medium", "COUNT_DUE", p.id, stock.lastCount?.at ?? now, "Opname terlambat", countAge == null ? "Belum pernah opname sejak BBM mulai dikeluarkan." : `Opname terakhir ${countAge} hari lalu (jadwal tiap ${COUNT_DUE_DAYS} hari).`);
      for (const c of stock.counts) {
        const info = countInfo.get(c.id);
        if (c.flagged)
          flag(c.variance < 0 ? "high" : "medium", "COUNT_VARIANCE", p.id, c.at, c.variance < 0 ? "Opname kurang dari stok sistem" : "Opname lebih dari stok sistem",
            `Fisik ${c.physical} L vs sistem ${c.system} L (selisih ${c.variance > 0 ? "+" : ""}${c.variance} L; BBM keluar sejak opname sebelumnya ${c.issuedSince} L) · ${info?.counter.name ?? ""}${info?.notes ? " · " + info.notes : ""}`);
      }
      return {
        ...p,
        stock: stock.stock,
        usage: stock.usage,
        perDay: stock.perDay,
        daysCover: stock.daysCover,
        avgPrice: Math.round(stock.avgPrice),
        inTransit,
        lastCount: stock.lastCount,
        countAge,
        counts: stock.counts.slice(-10).reverse().map((c) => ({ ...c, by: countInfo.get(c.id)?.counter.name, notes: countInfo.get(c.id)?.notes, fullDrums: countInfo.get(c.id)?.fullDrums, openLiters: countInfo.get(c.id)?.openLiters })),
        takers,
        recentLiters,
        estimatedShare: recentLiters ? estimated / recentLiters : 0,
      };
    });

  for (const s of shipments) {
    if (s.status !== "RECEIVED") continue;
    const short = s.liters - s.receivedLiters;
    if (short > s.liters * RECEIPT_TOLERANCE || s.receivedDrums < s.drums || !s.sealIntact)
      flag("high", "RECEIPT_SHORT", s.projectId, s.receivedAt, `Kiriman ${s.number} tidak sesuai`,
        `Dikirim ${s.drums} drum/${s.liters} L, diterima ${s.receivedDrums} drum/${s.receivedLiters} L${s.sealIntact ? "" : ", segel rusak"}. Sopir ${s.driver ?? "-"} ${s.plateNumber ?? ""}${s.receiveNotes ? " · " + s.receiveNotes : ""}`);
  }

  const active = issues.filter((i) => !i.voidedAt);
  for (const [, rows] of Map.groupBy(active, (i) => i.vehicle.id)) {
    const vehicle = rows[0].vehicle, unit = meterUnit(vehicle.type);
    const result = consumption(rows.map((r) => ({ id: r.id, at: r.date, liters: r.liters, meterValue: r.meterValue, runHours: r.runHours })));
    for (const f of result.flags) {
      const row = rows.find((r) => r.id === f.id);
      if (f.kind === "METER_BACKWARD")
        flag("high", "METER_BACKWARD", row.projectId, row.date, `${unit} mundur: ${vehicle.name}`, `${unit} ${row.meterValue} lebih kecil dari pengisian sebelumnya · ${row.liters} L oleh ${row.employee?.name ?? row.takerName}`, row.id);
      else
        flag("medium", "HIGH_RATE", row.projectId, row.date, `Pemakaian boros: ${vehicle.name}`, `${row.liters} L, rasio ${f.rate.toFixed(2)} L/${unit ?? "jam"} vs median ${result.median.toFixed(2)} · pengambil ${row.employee?.name ?? row.takerName}`, row.id);
    }
  }
  for (const i of active) {
    if (i.liters > LARGE_ISSUE_LITERS)
      flag("medium", "LARGE_ISSUE", i.projectId, i.date, `Pengambilan besar: ${i.liters} L`, `${i.vehicle.name} · pengambil ${i.employee?.name ?? i.takerName} · ${FUEL_METHODS[i.method]}`, i.id);
    if (!i.employee)
      flag("info", "NO_CARD", i.projectId, i.date, "Pengambil tanpa kartu", `${i.takerName} · ${i.liters} L untuk ${i.vehicle.name}`, i.id);
  }
  const order = { high: 0, medium: 1, info: 2 };
  anomalies.sort((a, b) => order[a.severity] - order[b.severity] || new Date(b.at) - new Date(a.at));
  return { sites, requests, shipments, issues, anomalies, projects };
}
