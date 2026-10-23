// Penugasan proyek yang diturunkan dari penempatan site E-HSE (aturan di lib/assignment-plan.js).
// Dijalankan setelah salinan penempatan berubah (sinkronisasi karyawan) dan setelah proyek ditautkan ke site.
// Idempoten: menjalankan ulang tidak membuat penugasan ganda.
import { prisma } from "../prisma.js";
import { coverageEnd, overlaps, planAssignments } from "../assignment-plan.js";
import { ensure } from "../validation.js";

const iso = (d) => d.toISOString().slice(0, 10);
const ASSIGNMENT_SELECT = {
  id: true, projectId: true, startDate: true, endDate: true, source: true, placementId: true,
  project: { select: { hseSiteId: true } },
};

const activeSiteProjects = () =>
  prisma.project.findMany({
    where: { status: "ACTIVE", hseSiteId: { not: null } },
    select: { id: true, code: true, name: true, hseSiteId: true, startDate: true },
    orderBy: { code: "asc" },
  });

/** Rencana untuk karyawan bertaut E-HSE yang riwayat penempatannya sudah diterima. `where` = filter Employee tambahan. */
async function plans(where = {}, today = new Date()) {
  const [employees, projects] = await Promise.all([
    prisma.employee.findMany({
      where: { ...where, personnelId: { not: null }, placementsSyncedAt: { not: null } },
      select: {
        id: true, name: true, nip: true, isActive: true,
        placements: { orderBy: { startDate: "asc" } },
        projects: { select: ASSIGNMENT_SELECT },
      },
    }),
    activeSiteProjects(),
  ]);
  return {
    projects,
    rows: employees.map((e) => ({
      employee: e,
      plan: planAssignments({
        placements: e.placements,
        assignments: e.projects.map(({ project, ...a }) => ({ ...a, projectSiteId: project.hseSiteId })),
        projects,
        isActive: e.isActive,
        today,
      }),
    })),
  };
}

/** Terapkan rencana: buat penugasan otomatis dan akhiri penugasan yang penempatannya selesai. */
export async function reconcileAssignments(where = {}) {
  const { rows } = await plans(where);
  const creates = rows.flatMap(({ employee, plan }) =>
    plan.create.map((c) => ({ ...c, employeeId: employee.id, source: "PLACEMENT", payType: "UNSET" })),
  );
  const closes = rows.flatMap(({ plan }) => plan.close);
  if (creates.length) await prisma.employeeProject.createMany({ data: creates });
  for (let i = 0; i < closes.length; i += 5)
    await Promise.all(closes.slice(i, i + 5).map((c) => prisma.employeeProject.update({ where: { id: c.id }, data: { endDate: c.endDate } })));
  return { created: creates.length, closed: closes.length };
}

/** Hal yang perlu ditindaklanjuti HRD di Master Data → Penugasan & tarif. */
export async function assignmentIssues() {
  const [{ rows, projects }, unsetRates, unlinkedProjects] = await Promise.all([
    plans({ isActive: true }),
    prisma.employeeProject.count({ where: { payType: "UNSET", endDate: null, employee: { isActive: true } } }),
    prisma.project.findMany({ where: { status: "ACTIVE", hseSiteId: null }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);
  const byId = new Map(projects.map((p) => [p.id, p]));
  const card = ({ id, name, nip }) => ({ id, name, nip });
  const pending = rows
    .filter((r) => r.plan.pending)
    .map(({ employee, plan }) => ({
      ...card(employee),
      siteCode: plan.pending.siteCode,
      startDate: plan.pending.startDate,
      role: plan.pending.role,
      projects: plan.pending.projectIds.map((id) => byId.get(id)).map(({ id, code, name }) => ({ id, code, name })),
    }));
  const sites = new Map();
  for (const { plan } of rows)
    if (plan.noProject) {
      const s = sites.get(plan.noProject.siteId) ?? { ...plan.noProject, count: 0 };
      s.count++;
      sites.set(s.siteId, s);
    }
  const mismatchedIds = rows.flatMap((r) => r.plan.mismatched);
  const mismatched = mismatchedIds.length
    ? await prisma.employeeProject.findMany({
        where: { id: { in: mismatchedIds } },
        select: { id: true, startDate: true, employee: { select: { name: true } }, project: { select: { code: true, hseSiteCode: true } } },
        take: 200,
      })
    : [];
  return { pending, sitesWithoutProject: [...sites.values()], mismatched, unsetRates, unlinkedProjects };
}

/**
 * Validasi penugasan yang diisi HRD: proyek wajib bertaut site, karyawan ditempatkan di site itu (atau di HO)
 * sepanjang periode penugasan, dan periode tidak tumpang tindih dengan penugasan lain di proyek yang sama.
 */
export async function checkManualAssignment(tx, data, id) {
  // Berurutan: satu koneksi transaksi tidak boleh menjalankan query paralel.
  const employee = await tx.employee.findUnique({ where: { id: data.employeeId }, select: { name: true, placementsSyncedAt: true, placements: true } });
  const project = await tx.project.findUnique({ where: { id: data.projectId }, select: { code: true, hseSiteId: true, hseSiteCode: true } });
  const others = await tx.employeeProject.findMany({ where: { employeeId: data.employeeId, projectId: data.projectId, ...(id ? { id: { not: id } } : {}) } });
  ensure(project, "Proyek tidak ditemukan.", 404);
  ensure(!others.some((o) => overlaps(o, data)), "Periode penugasan tumpang tindih dengan penugasan lain di proyek ini.", 409);
  // Riwayat penempatan belum diterima (E-HSE versi lama): aturan site belum dapat diperiksa.
  if (!employee?.placementsSyncedAt) return;
  ensure(project.hseSiteId, `Proyek ${project.code} belum ditautkan ke site E-HSE. Tautkan di menu Proyek dahulu.`);
  const end = coverageEnd(employee.placements, project.hseSiteId, data.startDate, { allowHo: true });
  ensure(
    end !== undefined,
    `${employee.name} tidak ditempatkan di site ${project.hseSiteCode} (E-HSE) pada ${iso(data.startDate)}. Personel site hanya dapat ditugaskan ke proyek di site penempatannya; personel HO ke proyek mana pun.`,
  );
  if (end)
    ensure(
      data.endDate && data.endDate <= end,
      `Penempatan ${employee.name} di E-HSE yang mencakup penugasan ini berakhir ${iso(end)}. Isi tanggal selesai paling lambat ${iso(end)}.`,
    );
}
