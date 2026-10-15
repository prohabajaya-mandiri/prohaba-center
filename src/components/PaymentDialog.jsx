"use client";
import { useState } from "react";
import { apiFetch, businessToday } from "@/lib/client-api";
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        background: "#0008",
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <form
        onSubmit={submit}
        className="card"
        style={{
          padding: 24,
          width: "min(480px,100%)",
          display: "grid",
          gap: 14,
        }}
      >
        <h2>{title}</h2>
        {error && (
          <p role="alert" className="alert alert-danger">
            {error}
          </p>
        )}
        <label>
          Nominal
          <input
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
        </label>
        <label>
          Tanggal
          <input
            name="payDate"
            className="form-input"
            type="date"
            defaultValue={businessToday()}
            required
          />
        </label>
        <label>
          Kas/bank
          <select name="bankAccountId" className="form-select" required>
            <option value="">Pilih kas/bank</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.accountNo} — {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Referensi transfer/kuitansi
          <input
            name="reference"
            className="form-input"
            required
            maxLength={200}
          />
        </label>
        <p>
          Pencatatan ini menyatakan pembayaran yang sudah terjadi. Tidak
          melakukan transfer bank.
        </p>
        <div>
          <button className="btn btn-primary" disabled={busy}>
            Simpan pembayaran
          </button>{" "}
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={busy}
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  );
}
