"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, businessToday } from "@/lib/client-api";
import PaymentDialog from "@/components/PaymentDialog";
const idr = (v) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(
    v,
  );
export default function FinanceClient({
  glAccounts,
  profitData,
  summary,
  purchaseInvoices,
  orders,
  projects,
  vendors,
}) {
  const router = useRouter(),
    [tab, setTab] = useState("hutang"),
    [payment, setPayment] = useState(null),
    [poId, setPoId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const accounts = glAccounts.filter(
      (a) => a.isActive && a.accountType === "KAS_BANK",
    ),
    po = orders.find((p) => p.id === poId);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget));
      if (body.poId) {
        delete body.projectId;
        delete body.vendorId;
      } else delete body.poId;
      await apiFetch("/api/finance/purchase-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
      setTab("hutang");
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
      <div className="kpi-grid">
        <div className="kpi-card">
          <p>Kas & Bank</p>
          <h2>{idr(accounts.reduce((s, a) => s + a.currentBalance, 0))}</h2>
        </div>
        <div className="kpi-card">
          <p>Sisa hutang</p>
          <h2>{idr(summary.outstanding)}</h2>
        </div>
        <div className="kpi-card">
          <p>Faktur lewat jatuh tempo</p>
          <h2>{summary.overdue}</h2>
        </div>
      </div>
      <nav className="tabs">
        {["hutang", "faktur baru", "buku besar", "laba proyek"].map((t) => (
          <button
            key={t}
            className={"tab " + (tab === t ? "active" : "")}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === "hutang" && (
        <div className="card" style={{ padding: 20 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Faktur / Proyek</th>
                <th>Pemasok</th>
                <th>Jatuh tempo</th>
                <th>Sisa hutang</th>
                <th>Terlambat</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {purchaseInvoices.map((i) => {
                const remaining = i.totalAmount - i.paidAmount,
                  days = Math.max(
                    0,
                    Math.floor(
                      (new Date(businessToday() + "T00:00:00Z") -
                        new Date(i.dueDate)) /
                        86400000,
                    ),
                  );
                return (
                  <tr key={i.id}>
                    <td>
                      {i.invoiceNo}
                      <br />
                      {i.project.code}
                    </td>
                    <td>{i.vendor.name}</td>
                    <td>{new Date(i.dueDate).toISOString().slice(0, 10)}</td>
                    <td>{idr(remaining)}</td>
                    <td>{remaining > 0 ? days : 0} hari</td>
                    <td>
                      {remaining > 0 && (
                        <button
                          className="btn btn-primary"
                          onClick={() => setPayment(i)}
                        >
                          Catat pembayaran
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {tab === "faktur baru" && (
        <form
          className="card"
          style={{ padding: 20, display: "grid", gap: 12, maxWidth: 700 }}
          onSubmit={submit}
        >
          <h2>Faktur pembelian</h2>
          <label>
            PO diterima
            <select
              name="poId"
              className="form-select"
              value={poId}
              onChange={(e) => setPoId(e.target.value)}
            >
              <option value="">Tanpa PO (faktur langsung)</option>
              {orders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.poNumber}
                </option>
              ))}
            </select>
          </label>
          {!poId && (
            <>
              <label>
                Proyek
                <select name="projectId" className="form-select" required>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Pemasok
                <select name="vendorId" className="form-select" required>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label>
            Nomor faktur pemasok
            <input
              name="invoiceNo"
              className="form-input"
              required
              maxLength={200}
            />
          </label>
          <label>
            Nilai sebelum pajak
            <input
              key={poId}
              name="amount"
              className="form-input"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={po?.totalAmount ?? ""}
              readOnly={!!po}
              required
            />
          </label>
          <label>
            Pajak (nominal)
            <input
              name="tax"
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              required
            />
          </label>
          <label>
            Tanggal faktur
            <input
              name="invoiceDate"
              type="date"
              className="form-input"
              defaultValue={businessToday()}
              required
            />
          </label>
          <label>
            Jatuh tempo
            <input name="dueDate" type="date" className="form-input" required />
          </label>
          <label>
            Catatan
            <textarea name="notes" className="form-input" maxLength={2000} />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            Simpan & jurnal
          </button>
          <Link href="/master-data?resource=accounts">Kelola mapping akun</Link>
        </form>
      )}
      {tab === "buku besar" && (
        <div className="card" style={{ padding: 20 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Akun</th>
                <th>Saldo awal</th>
                <th>Debit</th>
                <th>Kredit</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {glAccounts.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.accountNo} — {a.name}
                  </td>
                  <td>{idr(a.balance)}</td>
                  <td>{idr(a.debit)}</td>
                  <td>{idr(a.credit)}</td>
                  <td>{idr(a.currentBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "laba proyek" && (
        <div className="card" style={{ padding: 20 }}>
          <p>
            Pendapatan dan biaya dari jurnal yang sudah dicatat; uang muka
            pelanggan belum diakui sebagai pendapatan. Pembayaran payroll dan
            bon site diakui ketika dicatat. Catatan BBM/perawatan belum menjadi
            biaya buku besar sampai dibuat faktur pembeliannya.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Proyek</th>
                <th>Pendapatan</th>
                <th>Biaya</th>
                <th>Laba</th>
              </tr>
            </thead>
            <tbody>
              {profitData.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.code} — {p.name}
                  </td>
                  <td>{idr(p.revenue)}</td>
                  <td>{idr(p.cost)}</td>
                  <td>{idr(p.revenue - p.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {payment && (
        <PaymentDialog
          endpoint={
            "/api/finance/purchase-invoices/" + payment.id + "/payments"
          }
          amount={payment.totalAmount - payment.paidAmount}
          accounts={accounts}
          onClose={() => setPayment(null)}
          onSuccess={() => {
            setPayment(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
