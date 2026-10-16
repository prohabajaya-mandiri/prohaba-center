"use client";
import Link from "next/link";
import {
  Building2, Activity, Wallet, ArrowDownCircle, ArrowUpCircle, ArrowRight,
  LineChart, Package, CreditCard, Ruler, Landmark, Database,
} from "lucide-react";
import { canAccess } from "@/lib/access";
import { ROLE_LABELS, idr, fmtDate } from "@/lib/ui-labels";
import { StatusBadge } from "@/components/ui";

const SHORTCUTS = [
  ["scurve", "Kurva S & progres", "Rencana vs realisasi BOQ", LineChart],
  ["material-request", "Permintaan material", "Ajukan & setujui MR", Package],
  ["payroll", "Payroll", "Buat & setujui penggajian", CreditCard],
  ["documents", "Dokumen engineering", "Gambar kerja & spesifikasi", Ruler],
  ["finance", "Keuangan", "Hutang, buku besar, laba", Landmark],
  ["master-data", "Master data", "Pegawai, pemasok, akun", Database],
];

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

export default function DashboardClient({ user, total, active, projects, finance }) {
  const shortcuts = SHORTCUTS.filter(([path]) => canAccess(user.role, "/" + path));
  return (
    <div className="stack">
      <div>
        <h2 className="display-title" style={{ fontSize: 22 }} suppressHydrationWarning>
          {greeting()}, {user.name?.split(" ")[0] ?? "Bapak/Ibu"}
        </h2>
        <p className="muted" style={{ fontSize: 14.5, marginTop: 2 }}>
          Anda masuk sebagai {ROLE_LABELS[user.role] ?? user.role}. Berikut ringkasan dari data yang sudah tercatat.
        </p>
      </div>

      <div className="kpi-grid">
        <Link href="/projects" className="kpi-card navy">
          <div className="kpi-icon"><Building2 size={20} /></div>
          <div className="kpi-label">Seluruh proyek</div>
          <div className="kpi-value">{total}</div>
          <div className="kpi-trend">di luar proyek yang diarsipkan</div>
        </Link>
        <Link href="/projects" className="kpi-card green">
          <div className="kpi-icon"><Activity size={20} /></div>
          <div className="kpi-label">Proyek aktif</div>
          <div className="kpi-value">{active}</div>
          <div className="kpi-trend">sedang berjalan</div>
        </Link>
        {finance && (
          <>
            <Link href="/finance" className="kpi-card blue">
              <div className="kpi-icon"><Wallet size={20} /></div>
              <div className="kpi-label">Kas & bank</div>
              <div className="kpi-value">{idr(finance.cash)}</div>
              <div className="kpi-trend">saldo buku besar saat ini</div>
            </Link>
            <Link href="/finance" className="kpi-card orange">
              <div className="kpi-icon"><ArrowUpCircle size={20} /></div>
              <div className="kpi-label">Sisa hutang</div>
              <div className="kpi-value">{idr(finance.payable)}</div>
              <div className="kpi-trend">faktur pembelian belum lunas</div>
            </Link>
            <Link href="/revenue" className="kpi-card yellow">
              <div className="kpi-icon"><ArrowDownCircle size={20} /></div>
              <div className="kpi-label">Sisa piutang</div>
              <div className="kpi-value">{idr(finance.receivable)}</div>
              <div className="kpi-trend">faktur penjualan belum lunas</div>
            </Link>
          </>
        )}
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Proyek terbaru</div>
            <div className="card-subtitle">10 proyek terakhir yang dicatat</div>
          </div>
          <Link href="/projects" className="btn btn-outline btn-sm">
            Lihat semua <ArrowRight aria-hidden />
          </Link>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama proyek</th>
                <th>Klien</th>
                <th>Periode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="cell-title nowrap">{p.code}</td>
                  <td>
                    <div style={{ color: "var(--gray-900)", fontWeight: 500 }}>{p.name}</div>
                    {p.location && <div className="cell-sub">{p.location}</div>}
                  </td>
                  <td>{p.client || "-"}</td>
                  <td className="nowrap">{fmtDate(p.startDate)} – {fmtDate(p.endDate)}</td>
                  <td><StatusBadge value={p.status} /></td>
                </tr>
              ))}
              {!projects.length && (
                <tr>
                  <td colSpan={5} className="cell-empty">Belum ada proyek tercatat.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {shortcuts.length > 0 && (
        <section>
          <h2 className="section-title">Akses cepat</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
            {shortcuts.map(([path, label, hint, Icon]) => (
              <Link key={path} href={"/" + path} className="card shortcut-card">
                <span className="kpi-icon" style={{ margin: 0, background: "var(--brand-50)", color: "var(--brand-600)" }}>
                  <Icon size={20} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 600, color: "var(--gray-900)" }}>{label}</span>
                  <span style={{ display: "block", fontSize: 13.5, color: "var(--gray-500)" }}>{hint}</span>
                </span>
                <ArrowRight size={18} style={{ marginLeft: "auto", color: "var(--gray-400)" }} aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
