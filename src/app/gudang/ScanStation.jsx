'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle2, Keyboard, Trash2 } from 'lucide-react';
import CameraScanner from '@/components/field/CameraScanner';
import { feedback, useScannerKeys } from '@/components/field/offline';
import { apiFetch } from '@/lib/client-api';
import { fmtQty, parseScan } from '@/lib/stock';
import { useBasket } from './basket';

/**
 * Scan label QR rak (kamera HP atau pemindai USB) untuk membuka rak itu, lalu selesaikan keranjang
 * ambil menjadi satu dokumen barang keluar + surat jalan.
 */
export default function ScanStation({ projects, canEdit }) {
  const router = useRouter();
  const { lines, remove, clear } = useBasket();
  const [camera, setCamera] = useState(false);
  const [manual, setManual] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ projectId: '', destination: '', takerName: '', vehicleNo: '', driverName: '' });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function open(value) {
    const target = parseScan(value);
    if (!target) {
      feedback(false);
      return setError(`"${String(value).slice(0, 60)}" bukan label rak atau barang gudang.`);
    }
    feedback(true);
    setError('');
    router.push(`/gudang/${target.kind === 'location' ? 'l' : 'b'}/${target.code}`);
  }
  useScannerKeys(open, true);

  async function checkout(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/api/gudang/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'KELUAR',
          projectId: form.projectId || null,
          destination: form.projectId ? null : form.destination || null,
          takerName: form.takerName || null,
          vehicleNo: form.vehicleNo || null,
          driverName: form.driverName || null,
          lines: lines.map((l) => ({ itemId: l.itemId, locationId: l.locationId, qty: l.qty })),
        }),
      });
      const doc = await res.json();
      feedback(true);
      clear();
      setSaved(doc);
      setForm({ projectId: '', destination: '', takerName: '', vehicleNo: '', driverName: '' });
      router.refresh();
    } catch (err) {
      feedback(false);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Scan label rak</div>
            <div className="card-subtitle">Arahkan kamera ke QR di rak, atau pakai pemindai USB. Halaman rak terbuka untuk ambil, simpan atau pindah barang.</div>
          </div>
        </div>
        <div className="card-body stack">
          {camera ? (
            <CameraScanner onCode={open} />
          ) : (
            <button type="button" className="btn btn-primary btn-block" onClick={() => setCamera(true)}><Camera aria-hidden /> Buka kamera</button>
          )}
          <form className="toolbar" onSubmit={(e) => { e.preventDefault(); open(manual); }}>
            <input className="form-input" style={{ flex: 1 }} value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Atau ketik kode, mis. HO-R1-T2" aria-label="Kode rak atau SKU" />
            <button className="btn btn-outline"><Keyboard aria-hidden /> Buka</button>
          </form>
          {error && <p role="alert" className="alert alert-danger">{error}</p>}
        </div>
      </section>

      {saved && (
        <p role="status" className="alert alert-success">
          <CheckCircle2 aria-hidden />
          <span>Barang keluar tercatat sebagai {saved.number}. <Link href={`/gudang?tab=transaksi&doc=${saved.id}`}>Buka & cetak surat jalan</Link></span>
        </p>
      )}

      {canEdit && (
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Keranjang ambil ({lines.length})</div>
              <div className="card-subtitle">Barang yang ditekan “Ambil” di halaman rak. Selesaikan untuk membuat satu surat jalan.</div>
            </div>
          </div>
          {lines.length ? (
            <>
              <div className="table-wrapper">
                <table>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.itemId + l.locationId}>
                        <td><div className="cell-title">{l.name}</div><div className="cell-sub">{l.sku} · dari {l.locationCode}</div></td>
                        <td className="num nowrap" style={{ fontWeight: 600 }}>{fmtQty(l.qty)} {l.unit}</td>
                        <td><button type="button" className="icon-btn" onClick={() => remove(l.itemId, l.locationId)} aria-label={'Hapus ' + l.sku}><Trash2 size={16} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <form className="card-body stack" onSubmit={checkout}>
                <label>
                  <span className="form-label">Proyek tujuan</span>
                  <select className="form-select" value={form.projectId} onChange={set('projectId')}>
                    <option value="">Bukan proyek (isi tujuan lain)</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                  </select>
                </label>
                {!form.projectId && (
                  <label><span className="form-label required">Tujuan lain</span><input className="form-input" value={form.destination} onChange={set('destination')} placeholder="Mis. Workshop KM 19, Mess HO" required /></label>
                )}
                <label><span className="form-label required">Pengambil</span><input className="form-input" value={form.takerName} onChange={set('takerName')} placeholder="Nama lengkap" required /></label>
                <div className="form-grid">
                  <label><span className="form-label">Nomor kendaraan</span><input className="form-input" value={form.vehicleNo} onChange={set('vehicleNo')} /></label>
                  <label><span className="form-label">Sopir</span><input className="form-input" value={form.driverName} onChange={set('driverName')} /></label>
                </div>
                <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Menyimpan…' : `Simpan barang keluar (${lines.length} barang)`}</button>
                <button type="button" className="btn btn-outline btn-block" onClick={clear} disabled={busy}>Kosongkan keranjang</button>
              </form>
            </>
          ) : (
            <div className="card-body muted">Keranjang kosong. Scan rak, lalu tekan “Ambil” pada barang yang dikeluarkan.</div>
          )}
        </section>
      )}
    </div>
  );
}
