"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download, Paperclip, ClipboardCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { apiFetch, businessToday } from "@/lib/client-api";
import { useDialog } from "@/components/DialogProvider";
import { EmptyRow, Modal, StatusBadge } from "@/components/ui";
import { idr, fmtDate } from "@/lib/ui-labels";

export default function SitePurchaseClient({
  sitePurchases,
  projects,
  priceReferences,
  user,
  accounts,
}) {
  const router = useRouter(),
    { showAlert } = useDialog(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refId, setRefId] = useState(""),
    [showForm, setShowForm] = useState(false),
    [review, setReview] = useState(null),
    [reviewStatus, setReviewStatus] = useState("APPROVED"),
    [attachFor, setAttachFor] = useState(null);
  const ref = priceReferences.find((r) => r.id === refId),
    canReview = ["FINANCE", "TOP_MANAGEMENT"].includes(user.role),
    canCreate = ["PJO", "LOGISTIK", "TOP_MANAGEMENT"].includes(user.role);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(e.currentTarget),
        body = Object.fromEntries(form),
        upload = new FormData();
      const file = form.get("file");
      if (file && file.size > 4 * 1024 * 1024) throw new Error("Ukuran bukti melebihi batas 4 MB.");
      delete body.file;
      if (!body.priceReferenceId) delete body.priceReferenceId;
      upload.set("payload", JSON.stringify(body));
      upload.set("file", file);
      await apiFetch("/api/site-purchase", { method: "POST", body: upload });
      setRefId("");
      setShowForm(false);
      router.refresh();
      await showAlert("Bon pembelian terkirim dan menunggu review Finance.", "Berhasil");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function reviewPurchase(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/site-purchase/" + review.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
      });
      setReview(null);
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function attach(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/site-purchase/" + attachFor.id + "/receipt", { method: "POST", body: new FormData(e.currentTarget) });
      setAttachFor(null);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const notesRequired = Boolean(review && reviewStatus === "APPROVED" && review.priceFlag);
  const closeAll = () => { setShowForm(false); setReview(null); setAttachFor(null); setError(""); };

  return (
    <div className="stack">
      {canCreate && (
        <div className="toolbar">
          <p className="muted" style={{ flex: "1 1 300px", fontSize: 14 }}>
            Catat pembelian kecil di site beserta foto/PDF kuitansi. Harga dibandingkan dengan referensi harga di Master Data.
          </p>
          <button className="btn btn-primary" onClick={() => { setError(""); setShowForm(true); }}>
            <Plus aria-hidden /> Input bon pembelian
          </button>
        </div>
      )}

      <section className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Tanggal / proyek</th>
                <th>Barang / toko</th>
                <th className="num">Jumlah</th>
                <th className="num">Total</th>
                <th>Cek harga</th>
                <th>Status</th>
                <th className="num">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sitePurchases.map((sp) => {
                const canAttach = !sp.receiptUrl && sp.status === "PENDING" && (sp.requestedBy === user.id || user.role === "TOP_MANAGEMENT");
                return (
                  <tr key={sp.id}>
                    <td className="nowrap">
                      <div>{fmtDate(sp.purchaseDate)}</div>
                      <div className="cell-sub">{sp.project.code}</div>
                    </td>
                    <td style={{ minWidth: 200 }}>
                      <div className="cell-title">{sp.description}</div>
                      <div className="cell-sub">{sp.vendor}</div>
                    </td>
                    <td className="num nowrap">{Number(sp.quantity).toLocaleString("id-ID")} {sp.unit}</td>
                    <td className="num" style={{ fontWeight: 600, color: "var(--gray-900)" }}>{idr(sp.totalAmount)}</td>
                    <td>
                      {sp.priceFlag ? (
                        <span className="badge badge-warning"><AlertTriangle aria-hidden />{sp.flagPct === null ? "Tanpa referensi" : "Selisih " + sp.flagPct.toFixed(1) + "%"}</span>
                      ) : (
                        <span className="badge badge-success"><CheckCircle2 aria-hidden />Sesuai referensi</span>
                      )}
                    </td>
                    <td><StatusBadge value={sp.status} /></td>
                    <td>
                      <div className="row-actions">
                        {sp.receiptUrl ? (
                          <a className="action-btn" href={sp.receiptUrl} title="Unduh bukti" aria-label="Unduh bukti"><Download /></a>
                        ) : (
                          <span className="muted nowrap">Belum ada bukti</span>
                        )}
                        {canAttach && (
                          <button className="btn btn-outline btn-sm" onClick={() => { setError(""); setAttachFor(sp); }}><Paperclip aria-hidden /> Lampirkan</button>
                        )}
                        {canReview && sp.status === "PENDING" && (
                          <button className="btn btn-primary btn-sm" onClick={() => { setError(""); setReviewStatus("APPROVED"); setReview(sp); }}><ClipboardCheck aria-hidden /> Review</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!sitePurchases.length && <EmptyRow colSpan={7} title="Belum ada pembelian site" />}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <Modal
          title="Input bon pembelian site"
          onClose={closeAll}
          busy={busy}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={closeAll} disabled={busy}>Batal</button>
              <button type="submit" form="sp-form" className="btn btn-primary" disabled={busy}>{busy ? "Mengirim…" : "Kirim bon & bukti"}</button>
            </>
          }
        >
          <form id="sp-form" onSubmit={submit} className="form-stack">
            {error && <p role="alert" className="alert alert-danger">{error}</p>}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="sp-project">Proyek</label>
                <select id="sp-project" name="projectId" className="form-select" required>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="sp-date">Tanggal beli</label>
                <input id="sp-date" name="purchaseDate" type="date" className="form-input" defaultValue={businessToday()} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="sp-vendor">Toko / pemasok</label>
              <input id="sp-vendor" name="vendor" className="form-input" required maxLength={200} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sp-ref">Referensi harga</label>
              <select id="sp-ref" name="priceReferenceId" className="form-select" value={refId} onChange={(e) => setRefId(e.target.value)}>
                <option value="">Tanpa referensi — perlu review manual</option>
                {priceReferences.map((r) => <option key={r.id} value={r.id}>{r.itemCode} — {r.description} ({idr(r.refPrice)}/{r.unit})</option>)}
              </select>
            </div>
            <div className="form-grid">
              <div className="form-group span-full">
                <label className="form-label required" htmlFor="sp-desc">Uraian barang</label>
                <input id="sp-desc" key={"description" + refId} name="description" className="form-input" defaultValue={ref?.description ?? ""} required maxLength={500} />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="sp-unit">Satuan</label>
                <input id="sp-unit" key={"unit" + refId} name="unit" className="form-input" defaultValue={ref?.unit ?? ""} readOnly={!!ref} required maxLength={30} />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="sp-qty">Jumlah</label>
                <input id="sp-qty" name="quantity" type="number" min="0.001" step="0.001" className="form-input" required />
              </div>
              <div className="form-group span-full">
                <label className="form-label required" htmlFor="sp-price">Harga satuan (Rp)</label>
                <input id="sp-price" name="unitPrice" type="number" min="0.01" step="0.01" className="form-input" required />
                {ref && <div className="form-hint">Harga referensi: {idr(ref.refPrice)} per {ref.unit}</div>}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="sp-file">Foto / PDF kuitansi</label>
              <input id="sp-file" name="file" type="file" accept=".pdf,.png,.jpg,.jpeg" required />
              <div className="form-hint">Maksimal 4 MB.</div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sp-notes">Catatan</label>
              <textarea id="sp-notes" name="notes" className="form-input" maxLength={2000} />
            </div>
          </form>
        </Modal>
      )}

      {attachFor && (
        <Modal
          size="modal-sm"
          title="Lampirkan bukti pembelian"
          subtitle={attachFor.description}
          onClose={closeAll}
          busy={busy}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={closeAll} disabled={busy}>Batal</button>
              <button type="submit" form="attach-form" className="btn btn-primary" disabled={busy}>{busy ? "Mengunggah…" : "Lampirkan"}</button>
            </>
          }
        >
          <form id="attach-form" onSubmit={attach} className="form-stack">
            {error && <p role="alert" className="alert alert-danger">{error}</p>}
            <div className="form-group">
              <label className="form-label required" htmlFor="at-file">Foto / PDF kuitansi (maks. 4 MB)</label>
              <input id="at-file" name="file" type="file" accept=".pdf,.png,.jpg,.jpeg" required />
            </div>
          </form>
        </Modal>
      )}

      {review && (
        <Modal
          title={`Review: ${review.description}`}
          subtitle={`${review.project.code} · ${review.vendor} · ${idr(review.totalAmount)}`}
          onClose={closeAll}
          busy={busy}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={closeAll} disabled={busy}>Batal</button>
              <button type="submit" form="review-form" className={`btn ${reviewStatus === "REJECTED" ? "btn-danger" : "btn-primary"}`} disabled={busy}>
                {busy ? "Menyimpan…" : reviewStatus === "REJECTED" ? "Tolak bon" : "Setujui & catat pengeluaran"}
              </button>
            </>
          }
        >
          <form id="review-form" onSubmit={reviewPurchase} className="form-stack">
            {error && <p role="alert" className="alert alert-danger">{error}</p>}
            <p className="muted" style={{ fontSize: 14 }}>Persetujuan mencatat bon ini sebagai pengeluaran kas yang sudah terjadi.</p>
            {!review.receiptUrl && reviewStatus === "APPROVED" && (
              <p className="alert alert-warning"><AlertTriangle aria-hidden /> Bukti pembelian belum dilampirkan. Bon hanya dapat disetujui setelah bukti dilampirkan.</p>
            )}
            <div className="form-group">
              <label className="form-label required" htmlFor="rv-status">Keputusan</label>
              <select id="rv-status" name="status" className="form-select" value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
                <option value="APPROVED">Setujui & catat pengeluaran</option>
                <option value="REJECTED">Tolak</option>
              </select>
            </div>
            {reviewStatus === "APPROVED" && (
              <div className="form-group">
                <label className="form-label required" htmlFor="rv-bank">Kas / bank</label>
                <select id="rv-bank" name="bankAccountId" className="form-select" required defaultValue="">
                  <option value="" disabled>Pilih kas/bank</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.accountNo} — {a.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className={`form-label ${notesRequired ? "required" : ""}`} htmlFor="rv-notes">Alasan / catatan review</label>
              <textarea id="rv-notes" name="reviewNotes" className="form-input" maxLength={2000} required={notesRequired} />
              {notesRequired && <div className="form-hint">Wajib diisi karena harga berbeda dari referensi.</div>}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
