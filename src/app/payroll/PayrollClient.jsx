"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-api";
import { payrollTransition } from "@/lib/payroll-approval";
import PaymentDialog from "@/components/PaymentDialog";
const rupiah = (v) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(
    v,
  );
const actions = {
  SUBMIT: "Ajukan",
  HRD_APPROVE: "Setujui HRD",
  FINANCE_APPROVE: "Setujui Finance",
  TOP_APPROVE: "Setujui Direktur",
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
  return (
    <div style={{ display: "grid", gap: 20 }}>
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      {["TOP_MANAGEMENT", "HRD"].includes(user.role) && (
        <form
          className="card"
          style={{ padding: 20, display: "flex", gap: 12, flexWrap: "wrap" }}
          onSubmit={async (e) => {
            e.preventDefault();
            await run(
              "/api/payroll/generate",
              Object.fromEntries(new FormData(e.currentTarget)),
            );
          }}
        >
          <select name="projectId" className="form-select" required>
            <option value="">Pilih proyek</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input type="month" name="period" className="form-input" required />
          <button className="btn btn-primary" disabled={busy}>
            Buat payroll dari absensi & tarif penugasan
          </button>
        </form>
      )}
      <div className="card" style={{ padding: 20 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Periode</th>
              <th>Proyek</th>
              <th>Total</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {payrolls.map((p) => (
              <tr key={p.id}>
                <td>{p.period}</td>
                <td>{p.projectName}</td>
                <td>{rupiah(p.totalAmount)}</td>
                <td>{p.status}</td>
                <td>
                  <button
                    className="btn btn-outline"
                    onClick={() => setSelected(p)}
                  >
                    Rincian
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!payrolls.length && (
          <p>
            Belum ada payroll. Isi penugasan dan tarif di Master Data, lalu
            catat absensi.
          </p>
        )}
      </div>
      {selected && (
        <section className="card" style={{ padding: 20 }}>
          <h2>
            {selected.projectName} · {selected.period}
          </h2>
          <p>
            Status: {selected.status} · {rupiah(selected.totalAmount)}
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Pegawai</th>
                <th>Hari hadir</th>
                <th>Gaji pokok</th>
                <th>Lembur</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {selected.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.employeeName}</td>
                  <td>{i.workDays}</td>
                  <td>{rupiah(i.baseSalary)}</td>
                  <td>{rupiah(i.overtimePay)}</td>
                  <td>{rupiah(i.netSalary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {Object.entries(actions)
              .filter(
                ([action]) =>
                  payrollTransition(user.role, action)?.from ===
                  selected.status,
              )
              .map(([action, label]) => (
                <button
                  key={action}
                  disabled={busy}
                  className="btn btn-primary"
                  onClick={async () => {
                    const row = await run("/api/payroll/approve", {
                      payrollId: selected.id,
                      action,
                    });
                    if (row) setSelected({ ...selected, ...row });
                  }}
                >
                  {label}
                </button>
              ))}
            {selected.status === "APPROVED" &&
              ["TOP_MANAGEMENT", "FINANCE"].includes(user.role) && (
                <button
                  className="btn btn-primary"
                  onClick={() => setPayment(true)}
                >
                  Catat pembayaran
                </button>
              )}
            <button
              className="btn btn-outline"
              onClick={() => setSelected(null)}
            >
              Tutup
            </button>
          </div>
          <p>Persetujuan tidak menyatakan gaji sudah dibayar. Perhitungan memakai tarif penugasan dan absensi; tunjangan, potongan, BPJS, dan PPh belum dihitung otomatis.</p>
        </section>
      )}
      {payment && selected && (
        <PaymentDialog
          endpoint={"/api/payroll/" + selected.id + "/payments"}
          amount={selected.totalAmount}
          accounts={accounts}
          fixed
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
