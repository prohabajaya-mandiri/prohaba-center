"use client";
import Link from "next/link";
import { Printer, Info, AlertTriangle } from "lucide-react";
import { PrintDoc, printDocument } from "@/components/ui";

function CardSheet({ cards }) {
  return (
    <div className="qr-sheet">
      {cards.map((c) => (
        <div key={c.id} className="qr-card">
          <div className="qr-card-info">
            <div className="qr-card-brand">
              <img src="/brand/prohaba-mark.png" alt="" />
              <span>PT. Prohaba Jaya Mandiri<br />Kartu Absensi</span>
            </div>
            <strong className="qr-card-name">{c.name}</strong>
            <span className="qr-card-no">NIP {c.nip}</span>
            <span className="qr-card-meta">{c.position}{c.siteName ? ` · ${c.siteName}` : ""}</span>
          </div>
          {/* SVG dibuat di server oleh pustaka qrcode dari isi yang sudah ditandatangani. */}
          <div className="qr-card-code" dangerouslySetInnerHTML={{ __html: c.qr }} />
        </div>
      ))}
    </div>
  );
}

export default function QrCards({ cards, withoutNip, error, projectId, q, projects }) {
  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Kartu QR absensi</div>
            <div className="card-subtitle">Satu kartu per karyawan aktif yang sudah ber-NIP. Cetak di kertas A4, potong, lalu laminasi.</div>
          </div>
          <button type="button" className="btn btn-primary" onClick={printDocument} disabled={!cards.length}>
            <Printer aria-hidden /> Cetak {cards.length} kartu
          </button>
        </div>
        <form className="card-body toolbar" style={{ alignItems: "flex-end" }}>
          <input type="hidden" name="tab" value="kartu" />
          <div className="form-group">
            <label className="form-label" htmlFor="qc-project">Proyek penugasan</label>
            <select id="qc-project" name="project" defaultValue={projectId} className="form-select">
              <option value="">Semua karyawan aktif</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="qc-q">Nama / NIP</label>
            <input id="qc-q" name="q" defaultValue={q} className="form-input" placeholder="Cari nama atau NIP" />
          </div>
          <button className="btn btn-outline">Tampilkan</button>
        </form>
        <div className="card-body">
          {error && <p role="alert" className="alert alert-danger">{error}</p>}
          {withoutNip > 0 && (
            <p className="alert alert-warning">
              <AlertTriangle aria-hidden />
              <span>
                {withoutNip} karyawan aktif{projectId ? " di proyek ini" : ""} belum punya NIP sehingga belum dibuatkan kartu.{" "}
                <Link href="/master-data?resource=employees&nip=NONE">Lengkapi NIP di Master Data</Link>.
              </span>
            </p>
          )}
          <p className="alert alert-info">
            <Info aria-hidden />
            <span>QR ditandatangani sistem sehingga tidak bisa dibuat sendiri. QR tetap berlaku walau NIP kemudian diubah (cetak ulang agar NIP di kartu ikut berubah).</span>
          </p>
          {cards.length ? <CardSheet cards={cards} /> : !error && <p className="muted">Tidak ada karyawan aktif ber-NIP untuk filter ini.</p>}
        </div>
      </section>
      <PrintDoc>
        <CardSheet cards={cards} />
      </PrintDoc>
    </div>
  );
}
