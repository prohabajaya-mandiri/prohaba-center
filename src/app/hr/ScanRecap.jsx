import Link from "next/link";
import { ScanLine } from "lucide-react";
import { EmptyRow } from "@/components/ui";
import { fmtDate } from "@/lib/ui-labels";
import { MIN_SCANS, localTime, timeZoneLabel } from "@/lib/attendance-scan";

export default function ScanRecap({ rows, missing, day, projectId, projects }) {
  const complete = rows.filter((r) => r.scans.length >= MIN_SCANS).length;
  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Rekap scan barcode</div>
            <div className="card-subtitle">
              Scan pertama setiap hari otomatis tercatat HADIR di absensi harian. Kehadiran lengkap bila minimal {MIN_SCANS}× scan.
            </div>
          </div>
          <Link href="/absen" className="btn btn-primary" target="_blank">
            <ScanLine aria-hidden /> Buka kiosk scan
          </Link>
        </div>
        <form className="card-body toolbar" style={{ alignItems: "flex-end" }}>
          <input type="hidden" name="tab" value="scan" />
          <div className="form-group">
            <label className="form-label" htmlFor="sr-date">Tanggal</label>
            <input id="sr-date" name="date" type="date" defaultValue={day} className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sr-project">Proyek</label>
            <select id="sr-project" name="project" defaultValue={projectId} className="form-select">
              <option value="">Semua proyek</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button className="btn btn-outline">Tampilkan</button>
          <span className="spacer" />
          <span className="badge badge-success">{complete} lengkap</span>
          <span className="badge badge-warning">{rows.length - complete} kurang scan</span>
          {projectId && <span className="badge badge-danger">{missing.length} belum scan</span>}
        </form>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Proyek</th>
                <th>Jam scan</th>
                <th className="num">Jumlah</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id + r.projectName}>
                  <td>
                    <div className="cell-title">{r.name}</div>
                    <div className="muted">{r.employeeNo} · {r.position}</div>
                  </td>
                  <td>{r.projectName}</td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {r.scans.map((s, i) => (
                        <span key={i} className="chip" title={s.method === "KAMERA" ? "Scan kamera" : "Scanner"}>
                          {localTime(s.at, s.timeZone)} {timeZoneLabel(s.timeZone)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="num">{r.scans.length}×</td>
                  <td>
                    {r.scans.length >= MIN_SCANS
                      ? <span className="badge badge-success">Lengkap</span>
                      : <span className="badge badge-warning">Kurang {MIN_SCANS - r.scans.length} scan</span>}
                  </td>
                </tr>
              ))}
              {!rows.length && <EmptyRow colSpan={5} title={`Belum ada scan pada ${fmtDate(day)}`} hint="Scan kartu QR di kiosk absensi untuk mencatat kehadiran." />}
            </tbody>
          </table>
        </div>
      </section>

      {projectId && missing.length > 0 && (
        <section className="card">
          <div className="card-header">
            <div className="card-title">Ditugaskan tetapi belum scan</div>
            <span className="badge badge-danger">{missing.length} orang</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {missing.map((e) => (
              <span key={e.id} className="chip" style={{ fontSize: 13.5, padding: "5px 12px" }}>
                {e.name}<span style={{ color: "var(--gray-500)" }}> · {e.employeeNo}</span>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
