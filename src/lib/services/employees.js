// Master Data Karyawan terintegrasi E-HSE.
//
// Aturan:
// 1. E-HSE adalah sumber data tunggal. Tambah, ubah, status kerja dan import dikirim ke E-HSE; validasi,
//    deteksi NIK ganda, enkripsi data pribadi dan audit log dilakukan di sana.
// 2. Tabel Employee di ERP adalah salinan lokal (mirror) tanpa data sensitif, dipakai sebagai relasi
//    penugasan, absensi dan payroll. Salinan diperbarui segera setelah penulisan, dan ditarik berkala
//    dari umpan perubahan E-HSE (kursor updatedAt) — idempoten, aman diulang.
// 3. Data pegawai lama (sebelum integrasi) ditautkan berdasarkan NIK, riwayat payroll/absensi tetap utuh.
import { prisma } from "../prisma.js";
import { hseConfigured, hseFetch, SYSTEM_ACTOR } from "../hse-client.js";
import { audit, transaction } from "../transactions.js";
import { ensure, InputError } from "../validation.js";
import { MASTER_ROLES } from "../module-tabs.js";
import { reconcileAssignments } from "./assignments.js";

export const EMPLOYEE_ROLES = MASTER_ROLES.employees;
// Sesuai matriks E-HSE: HRD mengubah data; Top Management (= Direksi di E-HSE) hanya melihat.
export const EMPLOYEE_EDIT_ROLES = ["HRD"];
export const canEditEmployees = (user) => EMPLOYEE_EDIT_ROLES.includes(user?.role);
// Status kepegawaian PKWT/PKWTT hanya HRD (sama dengan EMPLOYMENT_ROLES E-HSE untuk peran ERP).
export const canSetEmployment = canEditEmployees;

export function requireEmployees(user, write = false) {
  ensure(EMPLOYEE_ROLES.includes(user?.role), "Master data karyawan tidak diizinkan.", 403);
  if (write) ensure(canEditEmployees(user), "Hanya HRD yang dapat mengubah data karyawan.", 403);
}

const day = (v) => (v ? new Date(v) : null);

/** Baris umpan E-HSE → kolom salinan lokal. */
export function mirrorData(p, now = new Date()) {
  return {
    personnelId: p.id,
    employeeNo: p.code,
    // Umpan E-HSE versi lama tidak membawa nip: jangan kosongkan NIP yang sudah tersalin.
    ...(p.nip !== undefined && { nip: p.nip }),
    name: p.name,
    nikLast4: p.nikLast4 ?? null,
    category: p.category ?? null,
    position: p.position,
    siteCode: p.siteCode ?? null,
    siteName: p.siteName ?? null,
    // Umpan versi lama tanpa id site: biarkan nilai yang sudah tersalin.
    ...(p.siteId !== undefined && { hseSiteId: p.siteId, hseSiteIsHo: Boolean(p.siteIsHo) }),
    workStatus: p.workStatus ?? null,
    employmentType: p.employmentType ?? null,
    contractEndDate: day(p.contractEndDate),
    phoneWa: p.phoneWa ?? null,
    bankName: p.bankName ?? null,
    bpjsKesehatan: p.bpjsKesehatan ?? null,
    bpjsKetenagakerjaan: p.bpjsKetenagakerjaan ?? null,
    joinDate: day(p.startDate),
    isActive: !p.isFormer,
    hseUpdatedAt: day(p.updatedAt),
    syncedAt: now,
  };
}

// Setelah tertaut, data pribadi lama dikosongkan: NIK/NPWP/rekening disimpan terenkripsi di E-HSE.
const CLEAR_LEGACY = { nik: null, npwp: null, bankAccount: null };

// Tiap baris idempoten (nilai lengkap dari E-HSE), jadi tidak perlu satu transaksi besar:
// baris baru dimasukkan sekaligus, baris lama diperbarui paralel terbatas (sesuai ukuran pool koneksi).
async function upsertRows(rows) {
  if (!rows.length) return 0;
  const now = new Date();
  const known = await prisma.employee.findMany({ where: { personnelId: { in: rows.map((p) => p.id) } }, select: { personnelId: true } });
  const existing = new Set(known.map((e) => e.personnelId));
  const fresh = rows.filter((p) => !existing.has(p.id));
  if (fresh.length) await prisma.employee.createMany({ data: fresh.map((p) => mirrorData(p, now)), skipDuplicates: true });
  const changed = rows.filter((p) => existing.has(p.id));
  for (let i = 0; i < changed.length; i += 5)
    await Promise.all(changed.slice(i, i + 5).map((p) => prisma.employee.update({ where: { personnelId: p.id }, data: mirrorData(p, now) })));
  await mirrorPlacements(rows.filter((p) => Array.isArray(p.placements)), now);
  return rows.length;
}

export const placementData = (pl) => ({
  id: pl.id,
  hseSiteId: pl.siteId,
  siteCode: pl.siteCode,
  siteIsHo: Boolean(pl.siteIsHo),
  position: pl.position,
  startDate: new Date(pl.startDate),
  endDate: day(pl.endDate),
  status: pl.status,
});

/**
 * Salinan riwayat penempatan ditulis ulang utuh per karyawan (satu transaksi), lalu penugasan proyek disesuaikan.
 * placementsSyncedAt baru diisi bila penulisan berhasil, sehingga baris yang gagal diulang pada sinkronisasi berikutnya.
 */
async function mirrorPlacements(rows, now) {
  if (!rows.length) return;
  const ids = await prisma.employee.findMany({ where: { personnelId: { in: rows.map((p) => p.id) } }, select: { id: true, personnelId: true } });
  const byPersonnel = new Map(ids.map((e) => [e.personnelId, e.id]));
  const work = rows.filter((p) => byPersonnel.has(p.id));
  for (let i = 0; i < work.length; i += 5)
    await Promise.all(
      work.slice(i, i + 5).map((p) => {
        const employeeId = byPersonnel.get(p.id);
        return prisma.$transaction([
          prisma.employeePlacement.deleteMany({ where: { employeeId } }),
          prisma.employeePlacement.createMany({ data: p.placements.map((pl) => ({ ...placementData(pl), employeeId })) }),
          prisma.employee.update({ where: { id: employeeId }, data: { placementsSyncedAt: now } }),
        ]);
      }),
    );
  await reconcileAssignments({ id: { in: work.map((p) => byPersonnel.get(p.id)) } });
}

/** Perbarui salinan untuk personel tertentu (dipanggil tepat setelah menulis ke E-HSE). */
export async function refreshEmployees(ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return 0;
  const { rows } = await hseFetch(SYSTEM_ACTOR, "/personnel/changes?" + new URLSearchParams({ ids: list.join(",") }));
  return upsertRows(rows);
}

let lastSync = 0;
let running = null;
// E-HSE versi lama tidak mengirim riwayat penempatan: lewati pengisian awal sampai instance dimulai ulang.
let placementsUnsupported = false;

/** Pengisian awal riwayat penempatan untuk salinan yang belum pernah menerimanya (umpan berkursor tidak mengirim ulang baris lama). */
async function backfillPlacements() {
  if (placementsUnsupported) return 0;
  const pending = await prisma.employee.findMany({ where: { personnelId: { not: null }, placementsSyncedAt: null }, select: { personnelId: true }, take: 1000 });
  let filled = 0;
  for (let i = 0; i < pending.length; i += 100) {
    const { rows } = await hseFetch(SYSTEM_ACTOR, "/personnel/changes?" + new URLSearchParams({ ids: pending.slice(i, i + 100).map((e) => e.personnelId).join(",") }));
    if (rows.some((p) => !Array.isArray(p.placements))) {
      placementsUnsupported = true;
      break;
    }
    filled += await upsertRows(rows);
  }
  return filled;
}

/** Tarik semua perubahan sejak kursor terakhir (updatedAt E-HSE terbesar yang sudah diterima). */
export function syncEmployees() {
  running ??= (async () => {
    try {
      await backfillPlacements();
      const max = await prisma.employee.aggregate({ _max: { hseUpdatedAt: true } });
      let cursor = max._max.hseUpdatedAt ? { since: new Date(max._max.hseUpdatedAt).toISOString() } : {};
      let synced = 0;
      for (let page = 0; page < 100; page++) {
        const { rows, next } = await hseFetch(SYSTEM_ACTOR, "/personnel/changes?" + new URLSearchParams({ limit: "500", ...cursor }));
        synced += await upsertRows(rows);
        if (!next) break;
        cursor = next;
      }
      lastSync = Date.now();
      return { synced };
    } finally {
      running = null;
    }
  })();
  return running;
}

/**
 * Sinkronisasi malas: maksimal sekali per 5 menit per instance, dipanggil saat halaman SDM/payroll dibuka.
 * Kegagalan tidak menghentikan halaman — ERP tetap memakai salinan terakhir.
 */
export async function ensureFreshEmployees(maxAgeMs = 5 * 60 * 1000) {
  if (!hseConfigured() || Date.now() - lastSync < maxAgeMs) return;
  try {
    await syncEmployees();
  } catch (error) {
    lastSync = Date.now() - maxAgeMs + 60 * 1000; // coba lagi 1 menit kemudian
    console.error("Sinkronisasi karyawan E-HSE gagal", error.message);
  }
}

// ─── Data pegawai lama (belum tertaut) ─────────────────────────────────────
export async function legacyEmployees() {
  return prisma.employee.findMany({
    where: { personnelId: null },
    orderBy: { name: "asc" },
    take: 500,
    select: {
      id: true, employeeNo: true, name: true, nik: true, position: true, employeeType: true, joinDate: true,
      npwp: true, bankName: true, bankAccount: true, bpjsKesehatan: true, bpjsKetenagakerjaan: true, isActive: true,
    },
  });
}

/** Satukan baris lama ke profil E-HSE `p`. Bila salinan baru tanpa riwayat sudah ada, salinan itu dihapus. */
async function linkLegacy(tx, legacyId, p) {
  const legacy = await tx.employee.findUnique({ where: { id: legacyId } });
  ensure(legacy && !legacy.personnelId, "Data pegawai lama sudah tertaut.", 409);
  const twin = await tx.employee.findUnique({
    where: { personnelId: p.id },
    include: { _count: { select: { projects: true, attendances: true, payrollItems: true } } },
  });
  if (twin) {
    const used = twin._count.projects + twin._count.attendances + twin._count.payrollItems;
    ensure(!used, `Profil ${p.name} sudah memiliki penugasan/absensi di ERP; satukan manual dengan data pegawai lama ${legacy.name}.`, 409);
    await tx.employee.delete({ where: { id: twin.id } });
  }
  return tx.employee.update({ where: { id: legacyId }, data: { ...mirrorData(p), ...CLEAR_LEGACY } });
}

/** Tautkan otomatis semua data lama yang NIK-nya sudah terdaftar di E-HSE. */
export async function linkLegacyByNik(user) {
  requireEmployees(user, true);
  const legacy = await prisma.employee.findMany({ where: { personnelId: null, nik: { not: null } }, select: { id: true, nik: true, employeeNo: true } });
  let linked = 0;
  const conflicts = [];
  for (let i = 0; i < legacy.length; i += 1000) {
    const chunk = legacy.slice(i, i + 1000);
    const { matches } = await hseFetch(user, "/personnel/lookup", { method: "POST", body: { niks: chunk.map((e) => e.nik.replace(/\s/g, "")) } });
    for (const [index, p] of matches.entries()) {
      if (!p) continue;
      try {
        await transaction(async (tx) => {
          const row = await linkLegacy(tx, chunk[index].id, p);
          await audit(tx, user, "MASTER_EMPLOYEES", "LINK_HSE", row.id, { employeeNo: chunk[index].employeeNo }, { employeeNo: p.code, personnelId: p.id });
        });
        linked++;
      } catch (error) {
        if (!(error instanceof InputError)) throw error;
        conflicts.push(error.message);
      }
    }
  }
  return { checked: legacy.length, linked, unmatched: legacy.length - linked - conflicts.length, conflicts };
}

/** Setelah data lama didaftarkan ke E-HSE lewat form, tautkan baris lamanya (riwayat payroll tetap). */
export async function linkLegacyToPersonnel(user, legacyId, personnelId) {
  const { rows } = await hseFetch(SYSTEM_ACTOR, "/personnel/changes?" + new URLSearchParams({ ids: personnelId }));
  ensure(rows[0], "Profil E-HSE tidak ditemukan.", 404);
  return transaction(async (tx) => {
    const row = await linkLegacy(tx, legacyId, rows[0]);
    await audit(tx, user, "MASTER_EMPLOYEES", "LINK_HSE", row.id, null, { employeeNo: rows[0].code, personnelId });
    return row;
  });
}

// ─── Tampilan cadangan saat E-HSE tidak dapat dihubungi ────────────────────
export async function mirrorList(f = {}, { skip = 0, take = 50 } = {}) {
  const where = { personnelId: { not: null }, isActive: f.former === "1" ? false : f.former === "all" ? undefined : true };
  if (f.category) where.category = f.category;
  if (f.workStatus) where.workStatus = f.workStatus;
  if (f.nip === "NONE") where.nip = null;
  else if (f.nip === "SET") where.nip = { not: null };
  if (f.q) {
    const q = String(f.q).slice(0, 80).trim();
    where.OR = [{ name: { contains: q, mode: "insensitive" } }, { nip: { contains: q, mode: "insensitive" } }, { position: { contains: q, mode: "insensitive" } }];
  }
  const [rows, total] = await Promise.all([
    prisma.employee.findMany({ where, skip, take, orderBy: { name: "asc" } }),
    prisma.employee.count({ where }),
  ]);
  return {
    total,
    rows: rows.map((e) => ({
      id: e.personnelId, nip: e.nip, name: e.name, nik: e.nikLast4 ? "************" + e.nikLast4 : "-", category: e.category,
      position: e.position, siteName: e.siteCode ?? "-", employmentType: e.employmentType, contractEndDate: e.contractEndDate,
      workStatus: e.workStatus, tenure: null, fitness: null, permitEnd: null,
    })),
  };
}

/** Penugasan proyek ERP untuk personel E-HSE tertentu (ditampilkan di detail karyawan). */
export async function erpAssignments(personnelId) {
  const employee = await prisma.employee.findUnique({
    where: { personnelId },
    select: {
      id: true, syncedAt: true,
      projects: { orderBy: { startDate: "desc" }, include: { project: { select: { code: true, name: true } } } },
    },
  });
  return employee ?? { id: null, syncedAt: null, projects: [] };
}

/** Daftar site E-HSE (data non-sensitif) untuk menautkan proyek ERP ke site. */
export async function hseSites() {
  const { rows } = await hseFetch(SYSTEM_ACTOR, "/sites");
  return rows;
}
