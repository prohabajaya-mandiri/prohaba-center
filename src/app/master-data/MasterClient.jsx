"use client";
import { apiFetch } from "@/lib/client-api";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const TYPES = [
  "KAS_BANK",
  "PIUTANG",
  "PERSEDIAAN",
  "AKTIVA_LANCAR_LAINNYA",
  "AKTIVA_TETAP",
  "AKUMULASI_PENYUSUTAN",
  "HUTANG",
  "KEWAJIBAN_JANGKA_PANJANG",
  "EKUITAS",
  "PENDAPATAN",
  "HARGA_POKOK_PENJUALAN",
  "BEBAN",
  "BEBAN_LAIN_LAIN",
  "PENDAPATAN_LAIN_LAIN",
];
const PURPOSES = [
  "",
  "CASH_BANK",
  "RECEIVABLE",
  "INPUT_TAX",
  "PAYABLE",
  "TAX_PAYABLE",
  "CUSTOMER_ADVANCE",
  "OPERATING_ACCRUAL",
  "REVENUE",
  "EXPENSE",
];
const FIELDS = {
  employees: [
    ["employeeNo", "Nomor pegawai"],
    ["name", "Nama"],
    ["nik", "NIK"],
    ["position", "Jabatan"],
    ["department", "Departemen"],
    ["employeeType", "Tipe", ["STAFF", "HARIAN", "BORONGAN"]],
    ["baseSalary", "Gaji dasar (informasi)", "number"],
    ["joinDate", "Mulai bekerja", "date"],
    ["bankAccount", "Rekening", "optional"],
    ["bankName", "Bank", "optional"],
    ["npwp", "NPWP", "optional"],
  ],
  assignments: [
    ["employeeId", "Pegawai", "employees"],
    ["projectId", "Proyek", "projects"],
    ["role", "Posisi di proyek"],
    ["startDate", "Mulai penugasan", "date"],
    ["endDate", "Selesai penugasan", "date-optional"],
    ["payType", "Dasar gaji", ["DAILY", "MONTHLY"]],
    ["dailyRate", "Tarif harian", "number-optional"],
    ["monthlyRate", "Alokasi bulanan untuk proyek", "number-optional"],
    ["overtimeRate", "Tarif lembur per jam", "number"],
  ],
  vendors: [
    ["code", "Kode"],
    ["name", "Nama pemasok"],
    ["contact", "Kontak", "optional"],
    ["phone", "Telepon", "optional"],
    ["email", "Email", "optional"],
    ["address", "Alamat", "optional"],
    ["npwp", "NPWP", "optional"],
  ],
  prices: [
    ["itemCode", "Kode barang"],
    ["description", "Uraian"],
    ["unit", "Satuan"],
    ["refPrice", "Harga referensi per satuan", "number"],
  ],
  accounts: [
    ["accountNo", "Nomor akun"],
    ["name", "Nama akun"],
    ["accountType", "Jenis akun", TYPES],
    ["purpose", "Mapping transaksi", PURPOSES],
    ["balance", "Saldo awal", "number"],
  ],
};
for (const resource of ["employees", "vendors", "accounts"])
  FIELDS[resource].push(["isActive", "Aktif", ["true", "false"]]);
const LABELS = {
  employees: "Pegawai",
  assignments: "Penugasan & tarif",
  vendors: "Pemasok",
  prices: "Referensi harga",
  accounts: "Akun buku besar",
};
export default function MasterClient({
  resource,
  resources,
  result,
  projects,
  employees,
  page,
}) {
  const [editing, setEditing] = useState(null),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      for (const [key, , type] of FIELDS[resource])
        if (
          typeof type === "string" &&
          type.endsWith("optional") &&
          body[key] === ""
        )
          delete body[key];
      if (body.isActive !== undefined) body.isActive = body.isActive === "true";
      const response = await apiFetch(
        "/api/master/" + resource + (editing ? "/" + editing.id : ""),
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setOpen(false);
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function initialize() {
    setBusy(true);
    setError("");
    try {
      const r = await apiFetch("/api/master/bootstrap", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card" style={{ padding: 24 }}>
      <nav
        style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}
      >
        {resources.map((key) => (
          <Link
            className="btn btn-outline"
            key={key}
            href={"/master-data?resource=" + key}
          >
            {LABELS[key]}
          </Link>
        ))}
      </nav>
      <h2>{LABELS[resource]}</h2>
      {resource === "assignments" && (
        <p>
          Tarif adalah alokasi untuk proyek ini. Bulanan memerlukan penugasan
          satu periode penuh; untuk periode parsial gunakan tarif harian. Tarif
          lembur harus diisi, termasuk 0 bila tidak berlaku.
        </p>
      )}
      {resource === "accounts" && (
        <p>
          Saldo awal diisi sebelum pencatatan jurnal. Saldo berjalan dihitung
          dari saldo awal dan seluruh jurnal.
        </p>
      )}
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: 12, margin: "16px 0" }}>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Tambah
        </button>
        {resource === "accounts" && (
          <button
            className="btn btn-outline"
            disabled={busy}
            onClick={initialize}
          >
            Siapkan mapping akun standar
          </button>
        )}
      </div>
      {open && (
        <form
          onSubmit={save}
          key={editing?.id ?? "new"}
          style={{
            padding: 16,
            border: "1px solid #ddd",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 12,
          }}
        >
          {FIELDS[resource].map(([key, label, type]) => {
            const options =
              type === "projects"
                ? projects.map((i) => [i.id, i.code + " — " + i.name])
                : type === "employees"
                  ? employees.map((i) => [i.id, i.name])
                  : Array.isArray(type)
                    ? type.map((i) => [i, i || "Tanpa mapping"])
                    : null;
            const raw = editing?.[key],
              value =
                typeof type === "string" && type.startsWith("date") && raw
                  ? new Date(raw).toISOString().slice(0, 10)
                  : raw === false
                    ? "false"
                    : raw === true
                      ? "true"
                      : (raw ?? "");
            return (
              <label key={key}>
                {label}
                {options ? (
                  <select
                    name={key}
                    className="form-select"
                    defaultValue={value}
                    required={key !== "purpose"}
                  >
                    <option value="">Pilih</option>
                    {options.map(([v, l]) => (
                      <option value={v} key={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={key}
                    className="form-input"
                    defaultValue={value}
                    type={
                      type?.startsWith?.("number")
                        ? "number"
                        : type?.startsWith?.("date")
                          ? "date"
                          : "text"
                    }
                    step={type?.startsWith?.("number") ? "0.01" : undefined}
                    required={!type?.endsWith?.("optional")}
                    maxLength={500}
                  />
                )}
              </label>
            );
          })}
          <div>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan"}
            </button>{" "}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setOpen(false)}
            >
              Batal
            </button>
          </div>
        </form>
      )}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {FIELDS[resource].slice(0, 4).map(([key, label]) => (
                <th key={key}>{label}</th>
              ))}
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.id}>
                {FIELDS[resource].slice(0, 4).map(([key]) => (
                  <td key={key}>
                    {key === "employeeId"
                      ? row.employee?.name
                      : key === "projectId"
                        ? row.project?.code
                        : String(row[key] ?? "—")}
                  </td>
                ))}
                <td>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setEditing(row);
                      setOpen(true);
                      setError("");
                    }}
                  >
                    Ubah
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        {page > 1 && (
          <Link href={"?resource=" + resource + "&page=" + (page - 1)}>
            Sebelumnya
          </Link>
        )}
        <span>
          Halaman {page} · {result.total} data
        </span>
        {page * 50 < result.total && (
          <Link href={"?resource=" + resource + "&page=" + (page + 1)}>
            Berikutnya
          </Link>
        )}
      </div>
    </div>
  );
}
