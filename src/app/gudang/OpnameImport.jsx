'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Info, Upload } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';
import { EmptyRow } from '@/components/ui';
import { idr } from '@/lib/ui-labels';

const num = (v) => Number(v ?? 0).toLocaleString('id-ID');

export default function OpnameImport() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [docDate, setDocDate] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function send(mode, chosen = file) {
    const body = new FormData();
    body.append('file', chosen);
    body.append('mode', mode);
    if (mode === 'commit') body.append('docDate', docDate);
    setBusy(mode);
    setError('');
    try {
      const res = await apiFetch('/api/gudang/import', { method: 'POST', body });
      setResult(await res.json());
      if (mode === 'commit') router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  const s = result?.summary;
  const done = result?.mode === 'commit';

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Import saldo awal</div>
            <div className="card-subtitle">Unggah laporan opname terakhir (format LIST STOK MATERIAL GUDANG KANTOR). Setiap barang mendapat SKU dan saldo awal di lokasi penampung HO-PENAMPUNG, lalu dipindah ke rak saat penataan. Saldo awal hanya bisa di-import sekali.</div>
          </div>
        </div>
        <div className="card-body stack">
          <label className="form-group" htmlFor="op-file">
            <span className="form-label">File Excel (.xlsx, maks. 4 MB)</span>
            <input id="op-file" type="file" accept=".xlsx" disabled={Boolean(busy)} onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setResult(null); if (f) send('preview', f); }} />
          </label>
          {busy === 'preview' && <p className="muted">Memeriksa file…</p>}
          {error && <p role="alert" className="alert alert-danger">{error}</p>}
          {result?.alreadyImported && !done && (
            <p className="alert alert-warning"><AlertTriangle aria-hidden /><span>Saldo awal sudah di-import ({result.alreadyImported}). Perubahan stok berikutnya dicatat sebagai transaksi.</span></p>
          )}
          {done && (
            <p role="status" className="alert alert-success">
              <CheckCircle2 aria-hidden /><span>Tersimpan sebagai {result.document}: {num(s.items)} barang. <Link href="/gudang?tab=stok">Lihat stok</Link></span>
            </p>
          )}
        </div>
      </section>

      {s && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card green"><div className="kpi-icon"><CheckCircle2 size={20} /></div><div className="kpi-label">Barang</div><div className="kpi-value">{num(s.items)}</div><div className="kpi-trend">{num(s.withStock)} ada stok · {num(s.merged)} baris dobel digabung</div></div>
            <div className="kpi-card blue"><div className="kpi-icon"><Info size={20} /></div><div className="kpi-label">Nilai saldo awal</div><div className="kpi-value">{idr(s.value)}</div><div className="kpi-trend">{num(s.noPrice)} barang tanpa harga</div></div>
            <div className="kpi-card red"><div className="kpi-icon"><AlertTriangle size={20} /></div><div className="kpi-label">Baris ditahan</div><div className="kpi-value">{num(s.blocked)}</div><div className="kpi-trend">dari {num(s.rows)} baris di sheet {result.sheetName}</div></div>
          </div>

          {!done && !result.alreadyImported && (
            <section className="card">
              <form className="card-body toolbar" style={{ alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); send('commit'); }}>
                <div className="form-group">
                  <label className="form-label required" htmlFor="op-date">Tanggal opname</label>
                  <input id="op-date" type="date" className="form-input" value={docDate} onChange={(e) => setDocDate(e.target.value)} required />
                </div>
                <p className="muted" style={{ flex: 1 }}>Tanggal saldo awal = tanggal opname di file (mis. 30-09-2026). Barang yang keluar/masuk sesudahnya dicatat sebagai transaksi biasa.</p>
                <button className="btn btn-primary" disabled={Boolean(busy) || !s.items || s.blocked > 0}>
                  <Upload aria-hidden /> {busy === 'commit' ? 'Menyimpan…' : `Simpan ${num(s.items)} barang`}
                </button>
              </form>
              {s.blocked > 0 && <div className="card-body"><p className="alert alert-warning"><AlertTriangle aria-hidden /><span>Perbaiki baris yang ditahan di Excel lalu unggah ulang; saldo awal harus lengkap sebelum disimpan.</span></p></div>}
            </section>
          )}

          <section className="card">
            <div className="card-header"><div className="card-title">Perlu dicek</div></div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Baris</th><th>Barang</th><th>Catatan</th></tr></thead>
                <tbody>
                  {result.blocked.map((b) => (
                    <tr key={'b' + b.rowNumber}>
                      <td>{b.rowNumber}</td>
                      <td>{b.name}</td>
                      <td style={{ color: 'var(--red-600)' }}>{b.errors.join(' ')}</td>
                    </tr>
                  ))}
                  {result.notes.map((n) => (
                    <tr key={n.rows.join('-')}>
                      <td>{n.rows.join(', ')}</td>
                      <td>{n.name}<div className="cell-sub">{n.group}</div></td>
                      <td>{n.warnings.map((w) => <div key={w}>{w}</div>)}</td>
                    </tr>
                  ))}
                  {!result.blocked.length && !result.notes.length && <EmptyRow colSpan={3} title="Tidak ada catatan" />}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
