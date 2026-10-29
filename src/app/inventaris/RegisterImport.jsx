'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Info, Upload } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';
import { EmptyRow } from '@/components/ui';

const num = (v) => Number(v ?? 0).toLocaleString('id-ID');

export default function RegisterImport() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [view, setView] = useState('blocked');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function send(mode, chosen = file) {
    const body = new FormData();
    body.append('file', chosen);
    body.append('mode', mode);
    setBusy(mode);
    setError('');
    try {
      const res = await apiFetch('/api/inventaris/import', { method: 'POST', body });
      const data = await res.json();
      setResult(data);
      setView(data.summary.blockedRows ? 'blocked' : 'warnings');
      if (mode === 'commit') router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  function choose(e) {
    const chosen = e.target.files?.[0] ?? null;
    setFile(chosen);
    setResult(null);
    if (chosen) send('preview', chosen);
  }

  const s = result?.summary;
  const shown = (result?.issues ?? []).filter((x) => (view === 'blocked' ? x.status === 'blocked' : x.status !== 'blocked'));
  const committed = result?.mode === 'commit';

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Import register aset</div>
            <div className="card-subtitle">
              Unggah file register yang sudah dipakai (format LIST ASSET PJM: sheet HSE, BT, MPK, OF, VEH). File diperiksa dulu; tidak ada yang tersimpan sebelum Anda menekan Simpan.
            </div>
          </div>
        </div>
        <div className="card-body stack">
          <label className="form-group" htmlFor="reg-file">
            <span className="form-label">File Excel (.xlsx, maks. 4 MB)</span>
            <input id="reg-file" type="file" accept=".xlsx" onChange={choose} disabled={Boolean(busy)} />
          </label>
          <p className="alert alert-info">
            <Info aria-hidden />
            <span>
              Satu baris pembelian dengan rentang <b>A S/D B</b> disimpan sebagai satu nomor per unit. Baris yang
              galat <b>ditahan</b> dan bisa diperbaiki di Excel lalu diunggah ulang — nomor yang sudah tersimpan dilewati,
              jadi file yang sama aman di-import berkali-kali.
            </span>
          </p>
          {busy === 'preview' && <p className="muted">Memeriksa file…</p>}
          {error && <p role="alert" className="alert alert-danger">{error}</p>}
          {committed && (
            <p role="status" className="alert alert-success">
              <CheckCircle2 aria-hidden />
              <span>
                {num(s.saved)} nomor register tersimpan. <Link href="/inventaris?tab=daftar">Lihat daftar aset</Link>
              </span>
            </p>
          )}
        </div>
      </section>

      {s && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card green">
              <div className="kpi-icon"><CheckCircle2 size={20} /></div>
              <div className="kpi-label">Baris siap disimpan</div>
              <div className="kpi-value">{num(s.okRows)}</div>
              <div className="kpi-trend">{num(s.newRegisters)} nomor register baru · {num(s.newUnits)} unit</div>
            </div>
            <div className="kpi-card red">
              <div className="kpi-icon"><AlertTriangle size={20} /></div>
              <div className="kpi-label">Baris ditahan</div>
              <div className="kpi-value">{num(s.blockedRows)}</div>
              <div className="kpi-trend">perlu diperbaiki di Excel</div>
            </div>
            <div className="kpi-card yellow">
              <div className="kpi-icon"><Info size={20} /></div>
              <div className="kpi-label">Baris dengan catatan</div>
              <div className="kpi-value">{num(s.warningRows)}</div>
              <div className="kpi-trend">tetap disimpan, untuk ditinjau</div>
            </div>
            <div className="kpi-card blue">
              <div className="kpi-icon"><FileSpreadsheet size={20} /></div>
              <div className="kpi-label">Sudah ada di sistem</div>
              <div className="kpi-value">{num(s.existingRows)}</div>
              <div className="kpi-trend">dari {num(s.rows)} baris di file</div>
            </div>
          </div>

          <section className="card">
            <div className="card-header">
              <div className="tabs-bar" role="tablist" style={{ marginBottom: 0, borderBottom: 0 }}>
                <button type="button" role="tab" aria-selected={view === 'blocked'} className={view === 'blocked' ? 'active' : ''} onClick={() => setView('blocked')}>
                  Ditahan ({num(s.blockedRows)})
                </button>
                <button type="button" role="tab" aria-selected={view === 'warnings'} className={view === 'warnings' ? 'active' : ''} onClick={() => setView('warnings')}>
                  Catatan ({num(s.warningRows)})
                </button>
              </div>
              {!committed && (
                <button type="button" className="btn btn-primary" onClick={() => send('commit')} disabled={Boolean(busy) || !s.okRows}>
                  <Upload aria-hidden /> {busy === 'commit' ? 'Menyimpan…' : `Simpan ${num(s.okRows)} baris`}
                </button>
              )}
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Sheet / baris</th>
                    <th>Kode</th>
                    <th>Aset</th>
                    <th className="num">QTY</th>
                    <th>{view === 'blocked' ? 'Galat' : 'Catatan'}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((x) => (
                    <tr key={x.sheet + x.rowNumber}>
                      <td className="nowrap">{x.sheet} · {x.rowNumber}</td>
                      <td style={{ maxWidth: 260, wordBreak: 'break-word' }}>{x.code}</td>
                      <td>
                        <div className="cell-title">{x.name ?? '-'}</div>
                        <div className="cell-sub">{x.location ?? '-'}</div>
                      </td>
                      <td className="num">{x.quantity ?? '-'}</td>
                      <td style={{ minWidth: 280 }}>
                        {(view === 'blocked' ? x.errors : x.warnings).map((m) => <div key={m}>{m}</div>)}
                      </td>
                    </tr>
                  ))}
                  {!shown.length && <EmptyRow colSpan={5} title={view === 'blocked' ? 'Tidak ada baris yang ditahan' : 'Tidak ada catatan'} />}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
