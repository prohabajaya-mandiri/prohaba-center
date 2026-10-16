"use client";
import { useState } from "react";
import { Info } from "lucide-react";
import { apiFetch, businessToday } from "@/lib/client-api";
import { idr } from "@/lib/ui-labels";
import { Modal } from "./ui";

export default function PaymentDialog({
  endpoint,
  amount,
  accounts,
  onClose,
  onSuccess,
  fixed = false,
  title = "Catat pembayaran",
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          Object.fromEntries(new FormData(event.currentTarget)),
        ),
      });
      onSuccess();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={title}
      subtitle={`Sisa yang harus dibayar: ${idr(amount)}`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" form="payment-form" className="btn btn-primary" disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan pembayaran"}
          </button>
        </>
      }
    >
      <form id="payment-form" onSubmit={submit} className="form-stack">
        {error && (
          <p role="alert" className="alert alert-danger">
            {error}
          </p>
        )}
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label required" htmlFor="pay-amount">Nominal (Rp)</label>
            <input
              id="pay-amount"
              name="amount"
              className="form-input"
              type="number"
              min="0.01"
              max={amount}
              step="0.01"
              defaultValue={amount}
              required
              readOnly={fixed}
            />
          </div>
          <div className="form-group">
            <label className="form-label required" htmlFor="pay-date">Tanggal bayar</label>
            <input
              id="pay-date"
              name="payDate"
              className="form-input"
              type="date"
              defaultValue={businessToday()}
              required
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label required" htmlFor="pay-bank">Kas / bank</label>
          <select id="pay-bank" name="bankAccountId" className="form-select" required>
            <option value="">Pilih kas/bank</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.accountNo} — {a.name}
              </option>
            ))}
          </select>
          {!accounts.length && (
            <div className="form-hint">Belum ada akun kas/bank aktif. Tambahkan di Master Data → Akun buku besar.</div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label required" htmlFor="pay-ref">Referensi transfer / kuitansi</label>
          <input
            id="pay-ref"
            name="reference"
            className="form-input"
            required
            maxLength={200}
          />
        </div>
        <p className="alert alert-info">
          <Info aria-hidden />
          Pencatatan ini menyatakan pembayaran yang sudah terjadi. Sistem tidak
          melakukan transfer bank.
        </p>
      </form>
    </Modal>
  );
}
