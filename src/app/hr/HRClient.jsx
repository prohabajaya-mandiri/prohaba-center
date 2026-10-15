"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, businessToday } from "@/lib/client-api";
export default function HRClient({
  employees,
  attendances,
  employeeOptions,
  projects,
  user,
  filterDate,
}) {
  const router = useRouter(),
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
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ display: "grid", gap: 20 }}>
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      <div className="card" style={{ padding: 20 }}>
        <h2>Absensi proyek</h2>
        <form
          onSubmit={submit}
          style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
        >
          <select name="employeeId" className="form-select" required>
            <option value="">Pilih pegawai</option>
            {employeeOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select name="projectId" className="form-select" required>
            <option value="">Pilih proyek penugasan</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="date"
            className="form-input"
            defaultValue={businessToday()}
            required
          />
          <select name="status" className="form-select">
            {["HADIR", "IZIN", "SAKIT", "TIDAK_HADIR", "LIBUR"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label>
            Lembur (jam)
            <input
              type="number"
              name="overtime"
              className="form-input"
              min="0"
              max="24"
              step="0.25"
              defaultValue="0"
              required
            />
          </label>
          <input
            name="notes"
            className="form-input"
            placeholder="Catatan"
            maxLength={2000}
          />
          <button className="btn btn-primary" disabled={busy}>
            Simpan absensi
          </button>
        </form>
        <p>
          Penugasan dan tarif dikelola di{" "}
          {user.role === "PJO" ? (
            "Master Data oleh HRD"
          ) : (
            <Link href="/master-data">Master Data</Link>
          )}
          . Absensi yang sudah masuk payroll dikunci.
        </p>
      </div>
      <section className="card" style={{ padding: 20 }}>
        <h2>Riwayat absensi</h2>
        <form>
          <label>
            Tanggal{" "}
            <input
              name="date"
              type="date"
              defaultValue={filterDate}
              className="form-input"
            />
          </label>{" "}
          <button className="btn btn-outline">Tampilkan</button>{" "}
          <Link href="/hr">Semua tanggal</Link>
        </form>
        <table className="data-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Pegawai</th>
              <th>Proyek</th>
              <th>Status</th>
              <th>Lembur</th>
              <th>Dicatat oleh</th>
            </tr>
          </thead>
          <tbody>
            {attendances.map((a) => (
              <tr key={a.id}>
                <td>{a.date.slice(0, 10)}</td>
                <td>{a.employeeName}</td>
                <td>{a.projectName}</td>
                <td>{a.status}</td>
                <td>{a.overtime}</td>
                <td>{a.enteredBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card" style={{ padding: 20 }}>
        <h2>Pegawai aktif</h2>
        <p>
          {employees.map((e) => e.name + " (" + e.position + ")").join(", ") ||
            "Belum ada pegawai aktif."}
        </p>
      </section>
    </div>
  );
}
