"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wallet, ArrowUpCircle, AlertTriangle, Info } from "lucide-react";
import { apiFetch, businessToday } from "@/lib/client-api";
import PaymentDialog from "@/components/PaymentDialog";
import { EmptyRow, StatusBadge } from "@/components/ui";
import { idr, fmtDate } from "@/lib/ui-labels";
import { useDialog } from "@/components/DialogProvider";

export default function FinanceClient({
  tab = "hutang",
  glAccounts,
  profitData,
  summary,
  purchaseInvoices,
  orders,
  projects,
  vendors,
}) {
  const router = useRouter(),
    { showAlert } = useDialog(),
    [payment, setPayment] = useState(null),
    [poId, setPoId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const accounts = glAccounts.filter(
      (a) => a.isActive && a.accountType === "KAS_BANK",
    ),
    po = orders.find((p) => p.id === poId);
  const today = new Date(businessToday() + "T00:00:00Z");

  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(new FormData(form));
      if (body.dueDate < body.invoiceDate) throw new Error("Jatuh tempo tidak boleh sebelum tanggal faktur.");
      if (body.poId) {
        delete body.projectId;
        delete body.vendorId;
      } else delete body.poId;
      await apiFetch("/api/finance/purchase-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      form.reset();
      setPoId("");
      router.push("/finance?tab=hutang");
      await showAlert("Faktur pembelian tersimpan dan jurnal sudah dibuat.", "Berhasil");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="kpi-grid">
        <div className="kpi-card blue">
          <div className="kpi-icon"><Wallet size={20} /></div>
          <div className="kpi-label">Kas & bank</div>
          <div className="kpi-value">{idr(accounts.reduce((s, a) => s + a.currentBalance, 0))}</div>
          <div className="kpi-trend">{accounts.length} akun kas/bank aktif</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-icon"><ArrowUpCircle size={20} /></div>
          <div className="kpi-label">Sisa hutang</div>
          <div className="kpi-value">{idr(summary.outstanding)}</div>
          <div className="kpi-trend">faktur pembelian belum lunas</div>
        </div>
        <div className={`kpi-card ${summary.overdue ? "red" : "green"}`}>
          <div className="kpi-icon"><AlertTriangle size={20} /></div>
          <div className="kpi-label">Faktur lewat jatuh tempo</div>
          <div className="kpi-value">{summary.overdue}</div>
          <div className="kpi-trend">{summary.overdue ? "perlu segera dibayar" : "tidak ada yang terlambat"}</div>
        </div>
      </div>

      <div className="card">

        {tab === "hutang" && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Faktur / proyek</th>
                  <th>Pemasok</th>
                  <th>Jatuh tempo</th>
                  <th className="num">Sisa hutang</th>
                  <th>Status</th>
                  <th className="num">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {purchaseInvoices.map((i) => {
                  const remaining = i.totalAmount - i.paidAmount;
                  const days = Math.max(0, Math.floor((today - new Date(i.dueDate)) / 86400000));
                  return (
                    <tr key={i.id}>
                      <td>
                        <div className="cell-title">{i.invoiceNo}</div>
                        <div className="cell-sub">{i.project.code}</div>
                      </td>
                      <td>{i.vendor.name}</td>
                      <td className="nowrap">
                        {fmtDate(i.dueDate)}
                        {remaining > 0 && days > 0 && <div className="cell-sub" style={{ color: "var(--red-600)" }}>terlambat {days} hari</div>}
                      </td>
                      <td className="num" style={{ fontWeight: 600, color: "var(--gray-900)" }}>{idr(remaining)}</td>
                      <td><StatusBadge value={remaining <= 0 ? "PAID" : i.paidAmount > 0 ? "PARTIAL" : "UNPAID"} /></td>
                      <td className="num">
                        {remaining > 0 && (
                          <button className="btn btn-primary btn-sm" onClick={() => setPayment(i)}>
                            Catat pembayaran
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!purchaseInvoices.length && <EmptyRow colSpan={6} title="Belum ada faktur pembelian" hint="Tambahkan lewat tab Faktur pembelian baru." />}
              </tbody>
            </table>
          </div>
        )}

        {tab === "faktur" && (
          <form className="card-body form-stack" style={{ maxWidth: 760 }} onSubmit={submit}>
            {error && <p role="alert" className="alert alert-danger">{error}</p>}
            <div className="form-group">
              <label className="form-label" htmlFor="pi-po">PO yang sudah diterima</label>
              <select id="pi-po" name="poId" className="form-select" value={poId} onChange={(e) => setPoId(e.target.value)}>
                <option value="">Tanpa PO (faktur langsung)</option>
                {orders.map((p) => (
                  <option key={p.id} value={p.id}>{p.poNumber} — {idr(p.totalAmount)}</option>
                ))}
              </select>
              <div className="form-hint">Jika dipilih, proyek, pemasok, dan nilai mengikuti PO.</div>
            </div>
            {!poId && (
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label required" htmlFor="pi-project">Proyek</label>
                  <select id="pi-project" name="projectId" className="form-select" required defaultValue="">
                    <option value="" disabled>Pilih proyek</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label required" htmlFor="pi-vendor">Pemasok</label>
                  <select id="pi-vendor" name="vendorId" className="form-select" required defaultValue="">
                    <option value="" disabled>Pilih pemasok</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label required" htmlFor="pi-no">Nomor faktur pemasok</label>
              <input id="pi-no" name="invoiceNo" className="form-input" required maxLength={200} />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="pi-amount">Nilai sebelum pajak (Rp)</label>
                <input id="pi-amount" key={poId} name="amount" className="form-input" type="number" min="0.01" step="0.01" defaultValue={po?.totalAmount ?? ""} readOnly={!!po} required />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="pi-tax">Pajak (nominal Rp)</label>
                <input id="pi-tax" name="tax" className="form-input" type="number" min="0" step="0.01" defaultValue="0" required />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="pi-date">Tanggal faktur</label>
                <input id="pi-date" name="invoiceDate" type="date" className="form-input" defaultValue={businessToday()} required />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="pi-due">Jatuh tempo</label>
                <input id="pi-due" name="dueDate" type="date" className="form-input" required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pi-notes">Catatan</label>
              <textarea id="pi-notes" name="notes" className="form-input" maxLength={2000} />
            </div>
            <div className="form-actions start">
              <button className="btn btn-primary" disabled={busy}>{busy ? "Menyimpan…" : "Simpan & buat jurnal"}</button>
              <Link href="/master-data?resource=accounts" className="btn btn-outline">Kelola mapping akun</Link>
            </div>
          </form>
        )}

        {tab === "buku" && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Akun</th>
                  <th className="num">Saldo awal</th>
                  <th className="num">Debit</th>
                  <th className="num">Kredit</th>
                  <th className="num">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {glAccounts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="cell-title">{a.accountNo}</span> — {a.name}
                      {!a.isActive && <span className="badge badge-gray" style={{ marginLeft: 8 }}>Nonaktif</span>}
                    </td>
                    <td className="num">{idr(a.balance)}</td>
                    <td className="num">{idr(a.debit)}</td>
                    <td className="num">{idr(a.credit)}</td>
                    <td className="num" style={{ fontWeight: 600, color: "var(--gray-900)" }}>{idr(a.currentBalance)}</td>
                  </tr>
                ))}
                {!glAccounts.length && <EmptyRow colSpan={5} title="Belum ada akun buku besar" hint="Siapkan akun di Master Data → Akun buku besar." />}
              </tbody>
            </table>
          </div>
        )}

        {tab === "laba" && (
          <>
            <div className="card-body" style={{ paddingBottom: 0 }}>
              <p className="alert alert-info">
                <Info aria-hidden />
                Pendapatan dan biaya berasal dari jurnal yang sudah dicatat; uang muka pelanggan belum diakui sebagai pendapatan.
                Pembayaran payroll dan bon site diakui ketika dicatat. Catatan BBM/perawatan belum menjadi biaya buku besar sampai dibuat faktur pembeliannya.
              </p>
            </div>
            <div className="table-wrapper" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Proyek</th>
                    <th className="num">Pendapatan</th>
                    <th className="num">Biaya</th>
                    <th className="num">Laba</th>
                  </tr>
                </thead>
                <tbody>
                  {profitData.map((p) => {
                    const profit = p.revenue - p.cost;
                    return (
                      <tr key={p.id}>
                        <td><span className="cell-title">{p.code}</span> — {p.name}</td>
                        <td className="num">{idr(p.revenue)}</td>
                        <td className="num">{idr(p.cost)}</td>
                        <td className="num" style={{ fontWeight: 600, color: profit < 0 ? "var(--red-600)" : "var(--green-700)" }}>{idr(profit)}</td>
                      </tr>
                    );
                  })}
                  {!profitData.length && <EmptyRow colSpan={4} title="Belum ada data laba proyek" />}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {payment && (
        <PaymentDialog
          endpoint={"/api/finance/purchase-invoices/" + payment.id + "/payments"}
          amount={payment.totalAmount - payment.paidAmount}
          accounts={accounts}
          title={`Pembayaran faktur ${payment.invoiceNo}`}
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
