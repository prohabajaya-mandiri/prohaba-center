import test from "node:test";
import assert from "node:assert/strict";
import { coverageEnd, overlaps, planAssignments } from "../src/lib/assignment-plan.js";

const d = (s) => new Date(s + "T00:00:00Z");
const iso = (v) => v?.toISOString().slice(0, 10) ?? null;
const placement = (id, hseSiteId, startDate, endDate = null, extra = {}) => ({
  id, hseSiteId, siteCode: hseSiteId.toUpperCase(), siteIsHo: false, position: "Operator",
  startDate: d(startDate), endDate: endDate && d(endDate), status: endDate ? "ENDED" : "ACTIVE", ...extra,
});
const today = d("2026-10-25");

test("penempatan di site dengan satu proyek aktif membuat penugasan otomatis", () => {
  const plan = planAssignments({
    placements: [placement("pl1", "tbg", "2026-09-01")],
    assignments: [],
    projects: [{ id: "prj1", hseSiteId: "tbg", startDate: d("2026-09-15") }],
    today,
  });
  assert.deepEqual(plan.create.map((c) => [c.projectId, c.placementId, iso(c.startDate), c.role]), [["prj1", "pl1", "2026-09-15", "Operator"]]);
  assert.equal(plan.pending, null);
});

test("site dengan lebih dari satu proyek aktif menunggu pilihan HRD; site tanpa proyek ditandai", () => {
  const placements = [placement("pl1", "tbg", "2026-09-01")];
  const two = planAssignments({ placements, assignments: [], today, projects: [{ id: "a", hseSiteId: "tbg" }, { id: "b", hseSiteId: "tbg" }] });
  assert.equal(two.create.length, 0);
  assert.deepEqual(two.pending.projectIds, ["a", "b"]);
  const none = planAssignments({ placements, assignments: [], today, projects: [{ id: "c", hseSiteId: "lht" }] });
  assert.deepEqual(none.noProject, { siteId: "tbg", siteCode: "TBG" });
});

test("mutasi ke site lain mengakhiri penugasan di proyek site lama dan membuat penugasan baru", () => {
  const plan = planAssignments({
    placements: [placement("pl1", "tbg", "2026-01-01", "2026-09-30"), placement("pl2", "lht", "2026-10-01")],
    assignments: [{ id: "as1", projectId: "prj-tbg", projectSiteId: "tbg", startDate: d("2026-01-01"), endDate: null, source: "PLACEMENT", placementId: "pl1" }],
    projects: [{ id: "prj-tbg", hseSiteId: "tbg" }, { id: "prj-lht", hseSiteId: "lht", startDate: d("2026-01-01") }],
    today,
  });
  assert.deepEqual(plan.close.map((c) => [c.id, iso(c.endDate)]), [["as1", "2026-09-30"]]);
  assert.deepEqual(plan.create.map((c) => [c.projectId, iso(c.startDate)]), [["prj-lht", "2026-10-01"]]);
});

test("kembali ke site yang sama membuat periode penugasan baru, bukan membuka periode lama", () => {
  const plan = planAssignments({
    placements: [placement("pl1", "tbg", "2026-01-01", "2026-03-31"), placement("pl2", "lht", "2026-04-01", "2026-08-31"), placement("pl3", "tbg", "2026-09-01")],
    assignments: [{ id: "as1", projectId: "prj", projectSiteId: "tbg", startDate: d("2026-01-01"), endDate: d("2026-03-31"), source: "PLACEMENT", placementId: "pl1" }],
    projects: [{ id: "prj", hseSiteId: "tbg", startDate: d("2025-12-01") }],
    today,
  });
  assert.equal(plan.close.length, 0);
  assert.deepEqual(plan.create.map((c) => [c.placementId, iso(c.startDate)]), [["pl3", "2026-09-01"]]);
});

test("penugasan yang masih mencakup penempatan aktif tidak diubah dan tidak diduplikasi", () => {
  const plan = planAssignments({
    placements: [placement("pl1", "tbg", "2026-01-01")],
    assignments: [{ id: "as1", projectId: "prj", projectSiteId: "tbg", startDate: d("2026-02-01"), endDate: null, source: "MANUAL" }],
    projects: [{ id: "prj", hseSiteId: "tbg" }],
    today,
  });
  assert.deepEqual(plan, { close: [], create: [], pending: null, noProject: null, mismatched: [] });
});

test("penugasan dari penempatan yang sudah diakhiri HRD tidak dibuat ulang", () => {
  const plan = planAssignments({
    placements: [placement("pl1", "tbg", "2026-01-01")],
    assignments: [{ id: "as1", projectId: "prj", projectSiteId: "tbg", startDate: d("2026-01-01"), endDate: d("2026-05-31"), source: "PLACEMENT", placementId: "pl1" }],
    projects: [{ id: "prj", hseSiteId: "tbg" }],
    today,
  });
  assert.equal(plan.create.length, 0);
});

test("personel HO: tanpa penugasan otomatis, penugasan manual ke proyek mana pun tetap berlaku", () => {
  const plan = planAssignments({
    placements: [placement("pl1", "ho", "2026-01-01", null, { siteIsHo: true })],
    assignments: [{ id: "as1", projectId: "prj", projectSiteId: "tbg", startDate: d("2026-03-01"), endDate: null, source: "MANUAL" }],
    projects: [{ id: "prj", hseSiteId: "tbg" }],
    today,
  });
  assert.deepEqual(plan, { close: [], create: [], pending: null, noProject: null, mismatched: [] });
});

test("penugasan otomatis berakhir saat pindah ke HO; penugasan manual yang tidak sesuai penempatan ditandai", () => {
  const placements = [placement("pl1", "tbg", "2026-01-01", "2026-06-30"), placement("pl2", "ho", "2026-07-01", null, { siteIsHo: true })];
  const auto = planAssignments({
    placements, today, projects: [],
    assignments: [{ id: "as1", projectId: "prj", projectSiteId: "tbg", startDate: d("2026-01-01"), endDate: null, source: "PLACEMENT" }],
  });
  assert.deepEqual(auto.close.map((c) => [c.id, iso(c.endDate)]), [["as1", "2026-06-30"]]);
  const wrong = planAssignments({
    placements, today, projects: [],
    assignments: [{ id: "as2", projectId: "prj2", projectSiteId: "lht", startDate: d("2026-02-01"), endDate: null, source: "MANUAL" }],
  });
  assert.deepEqual(wrong.mismatched, ["as2"]);
  assert.equal(wrong.close.length, 0);
});

test("resign: penugasan ditutup dan tidak ada penugasan baru", () => {
  const plan = planAssignments({
    placements: [placement("pl1", "tbg", "2026-01-01", "2026-10-10")],
    assignments: [{ id: "as1", projectId: "prj", projectSiteId: "tbg", startDate: d("2026-01-01"), endDate: null, source: "PLACEMENT" }],
    projects: [{ id: "prj", hseSiteId: "tbg" }],
    isActive: false,
    today,
  });
  assert.deepEqual(plan.close.map((c) => iso(c.endDate)), ["2026-10-10"]);
  assert.equal(plan.create.length, 0);
});

test("cakupan penempatan menyambung antarbaris dan membedakan HO", () => {
  const placements = [placement("a", "tbg", "2026-01-01", "2026-03-31"), placement("b", "tbg", "2026-04-01", "2026-06-30"), placement("c", "ho", "2026-07-01", null, { siteIsHo: true })];
  assert.equal(iso(coverageEnd(placements, "tbg", d("2026-02-01"))), "2026-06-30");
  assert.equal(coverageEnd(placements, "tbg", d("2026-02-01"), { allowHo: true }), null);
  assert.equal(coverageEnd(placements, "lht", d("2026-02-01")), undefined);
  assert.equal(overlaps({ startDate: d("2026-01-01"), endDate: d("2026-01-31") }, { startDate: d("2026-01-31"), endDate: null }), true);
  assert.equal(overlaps({ startDate: d("2026-01-01"), endDate: d("2026-01-30") }, { startDate: d("2026-01-31"), endDate: null }), false);
});
