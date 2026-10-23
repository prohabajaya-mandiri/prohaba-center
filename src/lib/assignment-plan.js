// Aturan penugasan proyek dari penempatan site E-HSE. Fungsi murni (tanpa database) agar dapat diuji.
//
// 1. Proyek ERP ditautkan ke satu site E-HSE (Project.hseSiteId).
// 2. Penempatan aktif di site non-HO → penugasan otomatis bila site itu punya tepat satu proyek ERP aktif;
//    bila lebih dari satu, HRD memilih proyeknya; bila tidak ada, site perlu dibuatkan/ditautkan proyek ERP.
// 3. Penugasan berakhir saat penempatan di site proyek berakhir (mutasi, demobilisasi, resign).
// 4. Personel site hanya boleh ditugaskan ke proyek di site-nya; personel HO boleh ke proyek mana pun.
const DAY = 86400000;
const time = (d) => (d == null ? Infinity : new Date(d).getTime());

/**
 * Akhir rentang penempatan berturut-turut yang mencakup tanggal `from` dan membolehkan penugasan di site `siteId`.
 * Penempatan di HO ikut dihitung bila `allowHo`. Hasil: undefined = `from` tidak tercakup, null = berlanjut sampai sekarang.
 */
export function coverageEnd(placements, siteId, from, { allowHo = false } = {}) {
  const rows = placements
    .filter((p) => p.hseSiteId === siteId || (allowHo && p.siteIsHo))
    .sort((a, b) => time(a.startDate) - time(b.startDate));
  const start = time(from);
  let end;
  for (const p of rows) {
    if (end === undefined) {
      if (time(p.startDate) <= start && start <= time(p.endDate)) end = time(p.endDate);
    } else if (end !== Infinity && time(p.startDate) <= end + DAY) {
      end = Math.max(end, time(p.endDate));
    }
  }
  return end === undefined ? undefined : end === Infinity ? null : new Date(end);
}

/** Penempatan yang sedang berjalan (belum diakhiri) atau null. */
export const activePlacement = (placements) => placements.find((p) => p.status === "ACTIVE" && p.endDate == null) ?? null;

/**
 * Rencana sinkronisasi penugasan satu karyawan.
 * - `placements`: salinan penempatan E-HSE { id, hseSiteId, siteCode, siteIsHo, position, startDate, endDate, status }
 * - `assignments`: penugasan ERP { id, projectId, projectSiteId, startDate, endDate, source, placementId }
 * - `projects`: proyek ERP aktif yang sudah bertaut site { id, hseSiteId, startDate }
 * Hasil: close (akhiri penugasan), create (penugasan otomatis baru), pending (HRD memilih proyek),
 * noProject (site tanpa proyek ERP aktif), mismatched (penugasan yang tidak sesuai penempatan sejak awal).
 */
export function planAssignments({ placements, assignments, projects, isActive = true, today = new Date() }) {
  const plan = { close: [], create: [], pending: null, noProject: null, mismatched: [] };
  const ends = new Map();
  for (const a of assignments) {
    if (!a.projectSiteId) continue; // proyek belum bertaut site: tidak dikelola otomatis
    // Penugasan otomatis mengikuti penempatan di site itu saja; penugasan manual juga boleh lewat penempatan HO.
    const end = coverageEnd(placements, a.projectSiteId, a.startDate, { allowHo: a.source !== "PLACEMENT" });
    if (end === undefined) {
      if (a.endDate == null || time(a.endDate) >= time(today)) plan.mismatched.push(a.id);
      continue;
    }
    if (end && time(a.endDate) > end.getTime()) {
      plan.close.push({ id: a.id, endDate: end });
      ends.set(a.id, end);
    }
  }

  const current = activePlacement(placements);
  if (!isActive || !current || current.siteIsHo) return plan;
  const now = time(today);
  const covered = assignments.some((a) => {
    const end = ends.get(a.id) ?? a.endDate;
    return a.projectSiteId === current.hseSiteId && time(end) >= Math.min(now, time(current.startDate));
  });
  // Penugasan yang pernah dibuat dari penempatan ini (meski diakhiri HRD) tidak dibuat ulang.
  if (covered || assignments.some((a) => a.placementId === current.id)) return plan;
  const candidates = projects.filter((p) => p.hseSiteId === current.hseSiteId);
  const site = { siteId: current.hseSiteId, siteCode: current.siteCode };
  if (candidates.length === 1) {
    const [project] = candidates;
    plan.create.push({
      projectId: project.id,
      placementId: current.id,
      role: current.position,
      startDate: new Date(Math.max(time(current.startDate), time(project.startDate))),
    });
  } else if (candidates.length > 1) {
    plan.pending = { ...site, projectIds: candidates.map((p) => p.id), startDate: new Date(current.startDate), role: current.position };
  } else {
    plan.noProject = site;
  }
  return plan;
}

/** Periode [start, end] (end null = terbuka) yang saling tumpang tindih. */
export const overlaps = (a, b) => time(a.startDate) <= time(b.endDate) && time(b.startDate) <= time(a.endDate);
