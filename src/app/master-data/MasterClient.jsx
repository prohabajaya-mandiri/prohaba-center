"use client";
import { apiFetch } from "@/lib/client-api";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Info } from "lucide-react";
import { EmptyRow, Modal } from "@/components/ui";
import ListPager from "@/components/ListPager";

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
  assignments: [
    ["employeeId", "Karyawan", "employees"],
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
for (const resource of ["vendors", "accounts"])
  FIELDS[resource].push(["isActive", "Status", ["true", "false"]]);
const LABELS = {
  assignments: "Penugasan & tarif",
  vendors: "Pemasok",
  prices: "Referensi harga",
  accounts: "Akun buku besar",
};
const OPTION_LABEL = {
  STAFF: "Staff",
  HARIAN: "Harian",
  BORONGAN: "Borongan",
  DAILY: "Harian",
  MONTHLY: "Bulanan",
  true: "Aktif",
  false: "Nonaktif",
};
const humanize = (v) =>
  v === null || v === undefined || v === "" ? "—" : OPTION_LABEL[v] ?? String(v).replaceAll("_", " ");

export default function MasterClient({
  resource,
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
  const hasStatus = FIELDS[resource].some(([k]) => k === "isActive");
  const columns = FIELDS[resource].slice(0, 4);

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
      await apiFetch(
        "/api/master/" + resource + (editing ? "/" + editing.id : ""),
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
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
      await apiFetch("/api/master/bootstrap", { method: "POST" });
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const openForm = (row) => {
    setEditing(row);
    setError("");
    setOpen(true);
  };

  const cell = (row, key, type) => {
    if (key === "employeeId") return row.employee?.name ?? "—";
    if (key === "projectId") return row.project?.code ?? "—";
    if (type?.startsWith?.("date") && row[key])
      return new Date(row[key]).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    if (type?.startsWith?.("number") && row[key] != null) return Number(row[key]).toLocaleString("id-ID");
    return humanize(row[key]);
  };

  return (
    <div className="stack">
      <div className="card">

        <div className="toolbar" style={{ padding: "16px 20px", borderBottom: "1px solid var(--gray-200)" }}>
          <div style={{ flex: "1 1 320px" }}>
            <h2 style={{ fontSize: 17 }}>{LABELS[resource]}</h2>
            {resource === "assignments" && (
              <p className="muted" style={{ fontSize: 14, marginTop: 2 }}>
                Tarif adalah alokasi untuk proyek ini. Bulanan memerlukan penugasan satu periode penuh; untuk periode parsial
                gunakan tarif harian. Tarif lembur wajib diisi, termasuk 0 bila tidak berlaku.
              </p>
            )}
            {resource === "accounts" && (
              <p className="muted" style={{ fontSize: 14, marginTop: 2 }}>
                Saldo awal diisi sebelum pencatatan jurnal. Saldo berjalan dihitung dari saldo awal dan seluruh jurnal.
              </p>
            )}
          </div>
          {resource === "accounts" && (
            <button className="btn btn-outline" disabled={busy} onClick={initialize}>
              Siapkan mapping akun standar
            </button>
          )}
          <button className="btn btn-primary" onClick={() => openForm(null)}>
            <Plus aria-hidden /> Tambah
          </button>
        </div>

        {error && !open && (
          <p role="alert" className="alert alert-danger" style={{ margin: "16px 20px 0" }}>
            {error}
          </p>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {columns.map(([key, label, type]) => (
                  <th key={key} className={type?.startsWith?.("number") ? "num" : undefined}>{label}</th>
                ))}
                {hasStatus && <th>Status</th>}
                <th className="num">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id}>
                  {columns.map(([key, , type], i) => (
                    <td key={key} className={i === 0 ? "cell-title" : type?.startsWith?.("number") ? "num" : undefined}>
                      {cell(row, key, type)}
                    </td>
                  ))}
                  {hasStatus && (
                    <td>{row.isActive ? <span className="badge badge-success">Aktif</span> : <span className="badge badge-gray">Nonaktif</span>}</td>
                  )}
                  <td className="num">
                    <button className="btn btn-outline btn-sm" onClick={() => openForm(row)}>
                      <Pencil aria-hidden /> Ubah
                    </button>
                  </td>
                </tr>
              ))}
              {!result.rows.length && (
                <EmptyRow
                  colSpan={columns.length + (hasStatus ? 2 : 1)}
                  title={`Belum ada data ${LABELS[resource].toLowerCase()}`}
                  hint="Klik Tambah untuk menambahkan."
                />
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ListPager page={page} total={result.total} query={{ resource }} />

      {open && (
        <Modal
          size="modal-lg"
          title={(editing ? "Ubah " : "Tambah ") + LABELS[resource].toLowerCase()}
          onClose={() => setOpen(false)}
          busy={busy}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setOpen(false)} disabled={busy}>Batal</button>
              <button type="submit" form="master-form" className="btn btn-primary" disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </>
          }
        >
          <form onSubmit={save} id="master-form" key={editing?.id ?? "new"} className="form-stack">
            {error && <p role="alert" className="alert alert-danger">{error}</p>}
            {resource === "assignments" && (
              <p className="alert alert-info">
                <Info aria-hidden /> Isi tarif harian untuk dasar gaji harian, atau alokasi bulanan untuk dasar gaji bulanan.
              </p>
            )}
            <div className="form-grid">
              {FIELDS[resource].map(([key, label, type]) => {
                const options =
                  type === "projects"
                    ? projects.map((i) => [i.id, i.code + " — " + i.name])
                    : type === "employees"
                      ? employees.map((i) => [i.id, i.name + " · " + i.employeeNo])
                      : Array.isArray(type)
                        ? type.map((i) => [i, i === "" ? "Tanpa mapping" : humanize(i)])
                        : null;
                const raw = editing?.[key],
                  value =
                    typeof type === "string" && type.startsWith("date") && raw
                      ? new Date(raw).toISOString().slice(0, 10)
                      : raw === false
                        ? "false"
                        : raw === true
                          ? "true"
                          : (raw ?? (key === "isActive" ? "true" : ""));
                const required = options ? key !== "purpose" : !type?.endsWith?.("optional");
                const id = "md-" + key;
                return (
                  <div className="form-group" key={key}>
                    <label className={"form-label " + (required ? "required" : "")} htmlFor={id}>{label}</label>
                    {options ? (
                      <select id={id} name={key} className="form-select" defaultValue={value} required={required}>
                        {key !== "purpose" && <option value="">Pilih</option>}
                        {options.map(([v, l]) => (
                          <option value={v} key={v}>{l}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={id}
                        name={key}
                        className="form-input"
                        defaultValue={value}
                        type={type?.startsWith?.("number") ? "number" : type?.startsWith?.("date") ? "date" : "text"}
                        step={type?.startsWith?.("number") ? "0.01" : undefined}
                        required={required}
                        maxLength={500}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
