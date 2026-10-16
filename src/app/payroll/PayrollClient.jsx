"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Eye } from "lucide-react";
import { apiFetch, businessToday } from "@/lib/client-api";
import { payrollTransition } from "@/lib/payroll-approval";
import PaymentDialog from "@/components/PaymentDialog";
import { EmptyRow, Modal, StatusBadge } from "@/components/ui";
import { idr } from "@/lib/ui-labels";

const actions = {
  SUBMIT: "Ajukan",
  HRD_APPROVE: "Setujui (HRD)",
  FINANCE_APPROVE: "Setujui (Finance)",
  TOP_APPROVE: "Setujui (Direktur)",
};
const STEPS = [
  ["DRAFT", "Draft"],
  ["SUBMITTED", "Diajukan"],
  ["HRD_APPROVED", "HRD"],
  ["FINANCE_APPROVED", "Finance"],
  ["APPROVED", "Direktur"],
  ["PAID", "Dibayar"],
];
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const fmtPeriod = (p) => {
  const [y, m] = String(p || "").split("-");
  return m ? `${MONTHS[Number(m) - 1]} ${y}` : p;
};

export default function PayrollClient({ payrolls, projects, accounts, user }) {
  const router = useRouter(),
    [selected, setSelected] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [payment, setPayment] = useState(false);

  async function run(endpoint, body) {
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const row = await response.json();
      router.refresh();
      return row;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = selected ? STEPS.findIndex(([s]) => s === selected.status) : -1;

  return (
    <div className="stack">
      {error && !selected && <p role="alert" className="alert alert-danger">{error}</p>}

      {["TOP_MANAGEMENT", "HRD"].includes(user.role) && (
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Buat payroll</div>
              <div className="card-subtitle">Dihitung dari absensi dan tarif penugasan pada periode yang dipilih.</div>
            </div>
          </div>
          <form
            className="card-body toolbar"
            onSubmit={async (e) => {
              e.preventDefault();
              await run("/api/payroll/generate", Object.fromEntries(new FormData(e.currentTarget)));
            }}
          >
            <div className="form-group" style={{ flex: "1 1 260px" }}>
              <label className="form-label required" htmlFor="pr-project">Proyek</label>
              <select id="pr-project" name="projectId" className="form-select" required defaultValue="">
                <option value="" disabled>Pilih proyek</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="pr-period">Periode</label>
              <input id="pr-period" type="month" name="period" className="form-input" defaultValue={businessToday().slice(0, 7)} required />
            </div>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Memproses…" : "Buat payroll"}</button>
          </form>
        </section>
      )}

      <section className="card">
        <div className="card-header">
          <div className="card-title">Daftar payroll</div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Periode</th>
                <th>Proyek</th>
                <th className="num">Total</th>
                <th>Status</th>
                <th className="num">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {payrolls.map((p) => (
                <tr key={p.id}>
                  <td className="cell-title nowrap">{fmtPeriod(p.period)}</td>
                  <td>{p.projectName}</td>
                  <td className="num" style={{ fontWeight: 600, color: "var(--gray-900)" }}>{idr(p.totalAmount)}</td>
                  <td><StatusBadge value={p.status} /></td>
                  <td className="num">
                    <button className="btn btn-outline btn-sm" onClick={() => { setError(""); setSelected(p); }}>
                      <Eye aria-hidden /> Rincian
                    </button>
                  </td>
                </tr>
              ))}
              {!payrolls.length && (
                <EmptyRow colSpan={5} title="Belum ada payroll" hint="Isi penugasan dan tarif di Master Data, catat absensi, lalu buat payroll." />
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && !payment && (
        <Modal
          size="modal-lg"
          title={`${selected.projectName} · ${fmtPeriod(selected.period)}`}
          subtitle={`Total ${idr(selected.totalAmount)}`}
          onClose={() => setSelected(null)}
          busy={busy}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setSelected(null)} disabled={busy}>Tutup</button>
              {Object.entries(actions)
                .filter(([action]) => payrollTransition(user.role, action)?.from === selected.status)
                .map(([action, label]) => (
                  <button
                    key={action}
                    disabled={busy}
                    className="btn btn-primary"
                    onClick={async () => {
                      const row = await run("/api/payroll/approve", { payrollId: selected.id, action });
                      if (row) setSelected({ ...selected, ...row });
                    }}
                  >
                    {label}
                  </button>
                ))}
              {selected.status === "APPROVED" && ["TOP_MANAGEMENT", "FINANCE"].includes(user.role) && (
                <button className="btn btn-primary" onClick={() => setPayment(true)}>Catat pembayaran</button>
              )}
            </>
          }
        >
          <div className="form-stack">
            {error && <p role="alert" className="alert alert-danger">{error}</p>}
            <ol className="stepper" aria-label="Tahap persetujuan" style={{ listStyle: "none" }}>
              {STEPS.map(([s, l], i) => (
                <li key={s} className={`step ${i < stepIndex ? "done" : i === stepIndex ? "current" : ""}`}>{i + 1}. {l}</li>
              ))}
            </ol>
            <div className="table-wrapper" style={{ border: "1px solid var(--gray-200)", borderRadius: "var(--radius-md)" }}>
              <table>
                <thead>
                  <tr>
                    <th>Pegawai</th>
                    <th className="num">Hari hadir</th>
                    <th className="num">Gaji pokok</th>
                    <th className="num">Lembur</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.items ?? []).map((i) => (
                    <tr key={i.id}>
                      <td className="cell-title">{i.employeeName}</td>
                      <td className="num">{i.workDays}</td>
                      <td className="num">{idr(i.baseSalary)}</td>
                      <td className="num">{idr(i.overtimePay)}</td>
                      <td className="num" style={{ fontWeight: 600, color: "var(--gray-900)" }}>{idr(i.netSalary)}</td>
                    </tr>
                  ))}
                  {!selected.items?.length && <EmptyRow colSpan={5} title="Tidak ada rincian pegawai" />}
                </tbody>
              </table>
            </div>
            <p className="alert alert-info">
              <Info aria-hidden />
              Persetujuan tidak berarti gaji sudah dibayar. Perhitungan memakai tarif penugasan dan absensi; tunjangan, potongan, BPJS, dan PPh belum dihitung otomatis.
            </p>
          </div>
        </Modal>
      )}

      {payment && selected && (
        <PaymentDialog
          endpoint={"/api/payroll/" + selected.id + "/payments"}
          amount={selected.totalAmount}
          accounts={accounts}
          fixed
          title={`Pembayaran payroll ${fmtPeriod(selected.period)}`}
          onClose={() => setPayment(false)}
          onSuccess={() => {
            setPayment(false);
            setSelected({ ...selected, status: "PAID" });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
