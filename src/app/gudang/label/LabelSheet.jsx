'use client';

import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { PrintDoc, printDocument } from '@/components/ui';

function Sheet({ labels }) {
  return (
    <div className="stock-label-sheet">
      {labels.map((l) => (
        <div key={l.key} className="stock-label">
          {/* SVG dibuat di server oleh pustaka qrcode. */}
          <div className="stock-label-code" dangerouslySetInnerHTML={{ __html: l.qr }} />
          <div className="stock-label-info">
            <strong>{l.code}</strong>
            <span>{l.line}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LabelSheet({ labels }) {
  return (
    <div className="stack">
      <div className="toolbar">
        <Link className="btn btn-outline" href="/gudang"><ArrowLeft aria-hidden /> Kembali</Link>
        <p className="muted" style={{ flex: 1 }}>{labels.length} label 50 × 30 mm. Cetak di kertas stiker A4 dengan skala 100 %.</p>
        <button type="button" className="btn btn-primary" onClick={printDocument} disabled={!labels.length}><Printer aria-hidden /> Cetak</button>
      </div>
      <section className="card"><div className="card-body">{labels.length ? <Sheet labels={labels} /> : <p className="muted">Pilih barang atau lokasi dulu.</p>}</div></section>
      <PrintDoc><Sheet labels={labels} /></PrintDoc>
    </div>
  );
}
