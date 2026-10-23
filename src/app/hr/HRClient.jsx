"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Info, Pencil, ScanLine } from "lucide-react";
import { apiFetch, businessToday } from "@/lib/client-api";
import { useDialog } from "@/components/DialogProvider";
import { EmptyRow, Modal, StatusBadge } from "@/components/ui";
import { fmtDate } from "@/lib/ui-labels";
import { localTime, timeZoneLabel } from "@/lib/attendance-scan";

const STATUSES = [
  ["HADIR", "Hadir"],
  ["IZIN", "Izin"],
  ["SAKIT", "Sakit"],
  ["TIDAK_HADIR", "Tidak hadir"],
  ["LIBUR", "Libur"],
];

function SourceBadge({ a }) {
  if (a.scanCount)
    return (
      <span className="badge badge-info" title={a.lastScan ? `Scan terakhir ${localTime(a.lastScan.at, a.lastScan.timeZone)} ${timeZoneLabel(a.lastScan.timeZone)}` : undefined}>
        <ScanLine aria-hidden size={13} /> Scan {a.scanCount}×
      </span>
    );
  return <span className="badge badge-warning" title={a.notes ? `Alasan: ${a.notes}` : undefined}>Manual</span>;
}

export default function HRClient({
  employees,
  attendances,
  employeeOptions,
  projects,
  user,
  filterDate,
  filterSource,
  canCorrect,
}) {
  const router = useRouter(),
    { showAlert } = useDialog(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(canCorrect ? "HADIR" : "IZIN"),
    [editing, setEditing] = useState(null);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(new FormData(form));
      if (status !== "HADIR") body.overtime = "0";
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

  const manualPresent = status === "HADIR";
  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Catat izin, sakit & koreksi absensi</div>
            <div className="card-subtitle">
              Kehadiran harian tercatat otomatis dari scan kartu QR. Form ini untuk izin, sakit, libur, tidak hadir, dan hadir manual (khusus HRD, wajib alasan).
            </div>
          </div>
        </div>
        <form onSubmit={submit} className="card-body form-stack">
          {error && <p role="alert" className="alert alert-danger">{error}</p>}
          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label required" htmlFor="at-emp">Pegawai</label>
              <select id="at-emp" name="employeeId" className="form-select" required defaultValue="">
                <option value="" disabled>Pilih pegawai</option>
                {employeeOptions.map((e) => <option key={e.id} value={e.id}>{e.name}{e.nip ? ` · NIP ${e.nip}` : ""}</option>)}
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
              <select id="at-status" name="status" className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map(([v, l]) => (
                  <option key={v} value={v} disabled={v === "HADIR" && !canCorrect}>
                    {v === "HADIR" ? (canCorrect ? "Hadir (manual)" : "Hadir — lewat scan kartu QR") : l}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="at-ot">Lembur (jam)</label>
              <input id="at-ot" type="number" name="overtime" className="form-input" min="0" max="24" step="0.25" defaultValue="0" disabled={!manualPresent} required />
            </div>
            <div className="form-group">
              <label className={"form-label" + (manualPresent ? " required" : "")} htmlFor="at-notes">{manualPresent ? "Alasan hadir manual" : "Catatan"}</label>
              <input
                id="at-notes"
                name="notes"
                className="form-input"
                maxLength={2000}
                required={manualPresent}
                placeholder={manualPresent ? "mis. kartu hilang, HP PIC rusak" : "mis. surat dokter"}
              />
            </div>
          </div>
          <div className="form-actions start">
            <button className="btn btn-primary" disabled={busy}>{busy ? "Menyimpan…" : "Simpan absensi"}</button>
          </div>
          <p className="alert alert-info">
            <Info aria-hidden />
            <span>
              Absensi yang sudah masuk payroll terkunci. Lembur pada hari yang sudah di-scan diisi lewat tombol <strong>Ubah</strong> di riwayat (khusus HRD). Penugasan dan tarif dikelola di{" "}
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
            <input id="at-filter" name="date" type="date" defaultValue={filterDate} className="form-input" style={{ width: 170 }} />
            <label className="sr-only" htmlFor="at-source">Sumber</label>
            <select id="at-source" name="source" defaultValue={filterSource} className="form-select" style={{ width: 170 }}>
              <option value="">Semua sumber</option>
              <option value="SCAN">Scan kartu QR</option>
              <option value="MANUAL">Manual</option>
            </select>
            <button className="btn btn-outline">Tampilkan</button>
            {(filterDate || filterSource) && <Link href="/hr" className="btn btn-ghost">Reset</Link>}
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
                <th>Sumber</th>
                <th className="num">Lembur</th>
                <th>Dicatat / dikoreksi</th>
                {canCorrect && <th aria-label="Aksi" />}
              </tr>
            </thead>
            <tbody>
              {attendances.map((a) => (
                <tr key={a.id}>
                  <td className="nowrap">{fmtDate(a.date)}</td>
                  <td>
                    <div className="cell-title">{a.employeeName}</div>
                    <div className="muted">{a.nip ? `NIP ${a.nip}` : "NIP belum diisi"}</div>
                  </td>
                  <td>{a.projectName}</td>
                  <td><StatusBadge value={a.status} /></td>
                  <td><SourceBadge a={a} /></td>
                  <td className="num">{a.overtime} jam</td>
                  <td>
                    <div>{a.enteredBy}</div>
                    {a.edit && (
                      <div className="muted" title={a.edit.reason}>
                        Dikoreksi {a.edit.by} · {fmtDate(a.edit.at)}: {a.edit.reason}
                      </div>
                    )}
                  </td>
                  {canCorrect && (
                    <td className="num">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(a)}>
                        <Pencil aria-hidden /> Ubah
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!attendances.length && (
                <EmptyRow
                  colSpan={canCorrect ? 8 : 7}
                  title={filterDate ? `Tidak ada absensi pada ${fmtDate(filterDate)}` : "Belum ada absensi tercatat"}
                />
              )}
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

      {editing && <CorrectDialog row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />}
    </div>
  );
}

function CorrectDialog({ row, onClose, onSaved }) {
  const [status, setStatus] = useState(row.status),
    [overtime, setOvertime] = useState(String(row.overtime)),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const present = status === "HADIR";

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/hr/attendance/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, overtime: present ? overtime : "0", reason }),
      });
      onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Ubah absensi"
      subtitle={`${row.employeeName} · ${fmtDate(row.date)} · ${row.projectName}`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Batal</button>
          <button type="submit" form="correct-form" className="btn btn-primary" disabled={busy}>{busy ? "Menyimpan…" : "Simpan koreksi"}</button>
        </>
      }
    >
      <form id="correct-form" onSubmit={save} className="form-stack">
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        {row.scanCount > 0 && (
          <p className="alert alert-info">
            <ScanLine aria-hidden />
            <span>
              {row.scanCount}× scan kartu QR
              {row.lastScan && `, terakhir ${localTime(row.lastScan.at, row.lastScan.timeZone)} ${timeZoneLabel(row.lastScan.timeZone)}`}. Log scan tetap tersimpan
              {row.status === "HADIR" && "; bila status diubah dari Hadir, scan berikutnya pada tanggal ini ditolak"}.
            </span>
          </p>
        )}
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label required" htmlFor="ca-status">Status</label>
            <select id="ca-status" className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label required" htmlFor="ca-ot">Lembur (jam)</label>
            <input
              id="ca-ot"
              type="number"
              className="form-input"
              min="0"
              max="24"
              step="0.25"
              value={present ? overtime : "0"}
              onChange={(e) => setOvertime(e.target.value)}
              disabled={!present}
              required
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label required" htmlFor="ca-reason">Alasan koreksi</label>
          <textarea
            id="ca-reason"
            className="form-input"
            maxLength={500}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="mis. lembur bongkar muat sampai 20.00 sesuai SPL mandor"
          />
          <span className="muted">Nilai lama, nilai baru, dan alasan tercatat di audit log.</span>
        </div>
      </form>
    </Modal>
  );
}
