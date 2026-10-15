"use client";
import Link from "next/link";
import { canAccess } from "@/lib/access";
export default function DashboardClient({
  user,
  total,
  active,
  projects,
  finance,
}) {
  const idr = (v) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
    }).format(v);
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div className="kpi-grid">
        <div className="kpi-card">
          <p>Seluruh proyek</p>
          <h2>{total}</h2>
        </div>
        <div className="kpi-card">
          <p>Proyek aktif</p>
          <h2>{active}</h2>
        </div>
        {finance &&
          Object.entries({
            cash: "Kas & bank",
            payable: "Sisa hutang",
            receivable: "Sisa piutang",
          }).map(([key, label]) => (
            <div key={key} className="kpi-card">
              <p>{label}</p>
              <h2>{idr(finance[key])}</h2>
            </div>
          ))}
      </div>
      <section className="card" style={{ padding: 24 }}>
        <h2>Proyek terbaru</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>{p.code}</td>
                <td>{p.name}</td>
                <td>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!projects.length && <p>Belum ada proyek tercatat.</p>}
        <Link href="/projects">Lihat semua proyek</Link>
      </section>
      <nav style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        {[
          ["scurve", "Kurva S"],
          ["material-request", "Permintaan material"],
          ["payroll", "Payroll"],
          ["documents", "Dokumen"],
          ["finance", "Keuangan"],
          ["master-data", "Master Data"],
        ]
          .filter(([path]) => canAccess(user.role, "/" + path))
          .map(([path, label]) => (
            <Link key={path} href={"/" + path}>
              {label}
            </Link>
          ))}
      </nav>
    </div>
  );
}
