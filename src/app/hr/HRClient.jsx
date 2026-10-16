"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Info } from "lucide-react";
import { apiFetch, businessToday } from "@/lib/client-api";
import { useDialog } from "@/components/DialogProvider";
import { EmptyRow, StatusBadge } from "@/components/ui";
import { fmtDate } from "@/lib/ui-labels";

const STATUSES = [
  ["HADIR", "Hadir"],
  ["IZIN", "Izin"],
  ["SAKIT", "Sakit"],
  ["TIDAK_HADIR", "Tidak hadir"],
  ["LIBUR", "Libur"],
];

export default function HRClient({
  employees,
  attendances,
  employeeOptions,
  projects,
  user,
  filterDate,
}) {
  const router = useRouter(),
    { showAlert } = useDialog(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(new FormData(form));
      await apiFetch("/api/hr/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      form.elements.notes.value = "";
      form.elements.overtime.value = "0";
      router.refresh();
      await showAlert("Absensi tersimpan.", "Berhasil");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Catat absensi proyek</div>
            <div className="card-subtitle">Absensi yang sudah masuk payroll terkunci dan tidak dapat diubah.</div>
          </div>
        </div>
        <form onSubmit={submit} className="card-body form-stack">
          {error && <p role="alert" className="alert alert-danger">{error}</p>}
          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label required" htmlFor="at-emp">Pegawai</label>
              <select id="at-emp" name="employeeId" className="form-select" required defaultValue="">
                <option value="" disabled>Pilih pegawai</option>
                {employeeOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="at-project">Proyek penugasan</label>
              <select id="at-project" name="projectId" className="form-select" required defaultValue="">
                <option value="" disabled>Pilih proyek</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="at-date">Tanggal</label>
              <input id="at-date" type="date" name="date" className="form-input" defaultValue={businessToday()} required />
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="at-status">Status kehadiran</label>
              <select id="at-status" name="status" className="form-select" defaultValue="HADIR">
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="at-ot">Lembur (jam)</label>
              <input id="at-ot" type="number" name="overtime" className="form-input" min="0" max="24" step="0.25" defaultValue="0" required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="at-notes">Catatan</label>
              <input id="at-notes" name="notes" className="form-input" maxLength={2000} />
            </div>
          </div>
          <div className="form-actions start">
            <button className="btn btn-primary" disabled={busy}>{busy ? "Menyimpan…" : "Simpan absensi"}</button>
          </div>
          <p className="alert alert-info">
            <Info aria-hidden />
            <span>
              Penugasan dan tarif dikelola di{" "}
              {user.role === "PJO" ? "Master Data oleh HRD" : <Link href="/master-data?resource=assignments">Master Data → Penugasan & tarif</Link>}.
            </span>
          </p>
        </form>
      </section>

      <section className="card">
        <div className="card-header">
          <div className="card-title">Riwayat absensi</div>
          <form className="toolbar" style={{ alignItems: "center" }}>
            <label className="sr-only" htmlFor="at-filter">Tanggal</label>
            <input id="at-filter" name="date" type="date" defaultValue={filterDate} className="form-input" style={{ width: 180 }} />
            <button className="btn btn-outline">Tampilkan</button>
            {filterDate && <Link href="/hr" className="btn btn-ghost">Semua tanggal</Link>}
          </form>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Pegawai</th>
                <th>Proyek</th>
                <th>Status</th>
                <th className="num">Lembur</th>
                <th>Dicatat oleh</th>
              </tr>
            </thead>
            <tbody>
              {attendances.map((a) => (
                <tr key={a.id}>
                  <td className="nowrap">{fmtDate(a.date)}</td>
                  <td className="cell-title">{a.employeeName}</td>
                  <td>{a.projectName}</td>
                  <td><StatusBadge value={a.status} /></td>
                  <td className="num">{a.overtime} jam</td>
                  <td>{a.enteredBy}</td>
                </tr>
              ))}
              {!attendances.length && <EmptyRow colSpan={6} title={filterDate ? `Tidak ada absensi pada ${fmtDate(filterDate)}` : "Belum ada absensi tercatat"} />}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div className="card-title">Pegawai aktif</div>
          <span className="badge badge-gray">{employees.length} orang</span>
        </div>
        <div className="card-body">
          {employees.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {employees.map((e) => (
                <span key={e.id ?? e.name} className="chip" style={{ fontSize: 13.5, padding: "5px 12px" }}>
                  {e.name}{e.position ? <span style={{ color: "var(--gray-500)" }}> · {e.position}</span> : null}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">Belum ada pegawai aktif.</p>
          )}
        </div>
      </section>
    </div>
  );
}
