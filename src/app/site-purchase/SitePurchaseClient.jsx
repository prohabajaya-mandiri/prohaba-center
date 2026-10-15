"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, businessToday } from "@/lib/client-api";
const idr = (v) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(
    v,
  );
export default function SitePurchaseClient({
  sitePurchases,
  projects,
  priceReferences,
  user,
  accounts,
}) {
  const router = useRouter(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refId, setRefId] = useState(""),
    [review, setReview] = useState(null);
  const ref = priceReferences.find((r) => r.id === refId),
    canReview = ["FINANCE", "TOP_MANAGEMENT"].includes(user.role);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(e.currentTarget),
        body = Object.fromEntries(form),
        upload = new FormData();
      delete body.file;
      if (!body.priceReferenceId) delete body.priceReferenceId;
      upload.set("payload", JSON.stringify(body));
      upload.set("file", form.get("file"));
      await apiFetch("/api/site-purchase", { method: "POST", body: upload });
      e.target.reset();
      setRefId("");
      router.refresh();
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
  return (
    <div style={{ display: "grid", gap: 20 }}>
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      {["PJO", "LOGISTIK", "TOP_MANAGEMENT"].includes(user.role) && (
        <details className="card" style={{ padding: 20 }}>
          <summary>Input bon pembelian</summary>
          <form
            onSubmit={submit}
            style={{ display: "grid", gap: 12, maxWidth: 700, marginTop: 16 }}
          >
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
              Tanggal beli
              <input
                name="purchaseDate"
                type="date"
                className="form-input"
                defaultValue={businessToday()}
                required
              />
            </label>
            <label>
              Toko/pemasok
              <input
                name="vendor"
                className="form-input"
                required
                maxLength={200}
              />
            </label>
            <label>
              Referensi harga
              <select
                name="priceReferenceId"
                className="form-select"
                value={refId}
                onChange={(e) => setRefId(e.target.value)}
              >
                <option value="">Tanpa referensi — perlu review manual</option>
                {priceReferences.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.itemCode} — {r.description} ({idr(r.refPrice)}/{r.unit})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Uraian
              <input
                key={"description" + refId}
                name="description"
                className="form-input"
                defaultValue={ref?.description ?? ""}
                required
                maxLength={500}
              />
            </label>
            <label>
              Satuan
              <input
                key={"unit" + refId}
                name="unit"
                className="form-input"
                defaultValue={ref?.unit ?? ""}
                readOnly={!!ref}
                required
                maxLength={30}
              />
            </label>
            <label>
              Jumlah
              <input
                name="quantity"
                type="number"
                min="0.001"
                step="0.001"
                className="form-input"
                required
              />
            </label>
            <label>
              Harga satuan
              <input
                name="unitPrice"
                type="number"
                min="0.01"
                step="0.01"
                className="form-input"
                required
              />
            </label>
            <label>
              Foto/PDF kuitansi (maksimum 4 MB)
              <input
                name="file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                required
              />
            </label>
            <label>
              Catatan
              <textarea name="notes" className="form-input" maxLength={2000} />
            </label>
            <button className="btn btn-primary" disabled={busy}>
              Kirim bon & bukti
            </button>
          </form>
        </details>
      )}
      <section className="card" style={{ padding: 20 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal / Proyek</th>
              <th>Barang</th>
              <th>Jumlah</th>
              <th>Total</th>
              <th>Harga / Status</th>
              <th>Bukti / Review</th>
            </tr>
          </thead>
          <tbody>
            {sitePurchases.map((sp) => (
              <tr key={sp.id}>
                <td>
                  {new Date(sp.purchaseDate).toISOString().slice(0, 10)}
                  <br />
                  {sp.project.code}
                </td>
                <td>
                  {sp.description}
                  <br />
                  {sp.vendor}
                </td>
                <td>
                  {sp.quantity} {sp.unit}
                </td>
                <td>{idr(sp.totalAmount)}</td>
                <td>
                  {sp.priceFlag
                    ? sp.flagPct === null
                      ? "Tanpa referensi"
                      : "Selisih " + sp.flagPct.toFixed(1) + "%"
                    : "Dalam batas referensi"}
                  <br />
                  {sp.status}
                </td>
                <td>
                  {sp.receiptUrl ? (
                    <a href={sp.receiptUrl}>Unduh bukti</a>
                  ) : (
                    <span>Belum ada bukti</span>
                  )}
                  {!sp.receiptUrl &&
                    sp.status === "PENDING" &&
                    (sp.requestedBy === user.id ||
                      user.role === "TOP_MANAGEMENT") && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          try {
                            await apiFetch(
                              "/api/site-purchase/" + sp.id + "/receipt",
                              {
                                method: "POST",
                                body: new FormData(e.currentTarget),
                              },
                            );
                            router.refresh();
                          } catch (err) {
                            setError(err.message);
                          }
                        }}
                      >
                        <input
                          name="file"
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          required
                        />
                        <button className="btn btn-outline">Lampirkan</button>
                      </form>
                    )}
                  {canReview && sp.status === "PENDING" && (
                    <button
                      className="btn btn-outline"
                      onClick={() => setReview(sp)}
                    >
                      Review
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {review && (
        <form
          onSubmit={reviewPurchase}
          className="card"
          style={{ padding: 20, display: "grid", gap: 12 }}
        >
          <h2>Review: {review.description}</h2>
          <p>
            {idr(review.totalAmount)} · Persetujuan mencatat bon ini sebagai
            pengeluaran kas yang sudah terjadi.
          </p>
          <select name="status" className="form-select">
            <option value="APPROVED">Setujui & catat pengeluaran</option>
            <option value="REJECTED">Tolak</option>
          </select>
          <label>
            Kas/bank
            <select name="bankAccountId" className="form-select">
              <option value="">Pilih kas/bank untuk persetujuan</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountNo} — {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Alasan/catatan review
            <textarea
              name="reviewNotes"
              className="form-input"
              maxLength={2000}
            />
          </label>
          <div>
            <button className="btn btn-primary" disabled={busy}>
              Simpan review
            </button>{" "}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setReview(null)}
            >
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
