'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, QrCode } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';
import { EmptyRow } from '@/components/ui';
import { LOCATION_TYPES, locationCode } from '@/lib/stock';

export default function LocationList({ locations, canEdit }) {
  const router = useRouter();
  const [form, setForm] = useState({ type: 'RAK', bay: '1', level: '1', bin: '1', zone: '1', description: '' });
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const preview = locationCode({ ...form });

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/gudang/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          ...(form.type !== 'LANTAI' && { bay: form.bay, level: form.level }),
          ...(form.type === 'BIN' && { bin: form.bin }),
          ...(form.type === 'LANTAI' && { zone: form.zone }),
          description: form.description || null,
        }),
      });
      setForm((f) => ({ ...f, description: '', ...(f.type === 'RAK' ? { level: String(Number(f.level) + 1) } : f.type === 'BIN' ? { bin: String(Number(f.bin) + 1) } : { zone: String(Number(f.zone) + 1) }) }));
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (code) => setSelected((s) => { const n = new Set(s); n.has(code) ? n.delete(code) : n.add(code); return n; });
  const chosen = [...selected];

  return (
    <div className="stack">
      {canEdit && (
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Tambah lokasi</div>
              <div className="card-subtitle">Bay rak dinomori kiri→kanan dari pintu, tingkat dari bawah (T1 papan terbawah). Bin = kotak plastik barang kecil di satu tingkat.</div>
            </div>
          </div>
          <form className="card-body toolbar" style={{ alignItems: 'flex-end' }} onSubmit={add}>
            <div className="form-group">
              <label className="form-label" htmlFor="loc-type">Jenis</label>
              <select id="loc-type" className="form-select" value={form.type} onChange={set('type')}>
                <option value="RAK">Rak (bay + tingkat)</option>
                <option value="BIN">Bin di rak</option>
                <option value="LANTAI">Zona lantai</option>
              </select>
            </div>
            {form.type !== 'LANTAI' ? (
              <>
                <div className="form-group" style={{ minWidth: 90 }}><label className="form-label" htmlFor="loc-bay">Bay</label><input id="loc-bay" type="number" min="1" max="99" className="form-input" value={form.bay} onChange={set('bay')} /></div>
                <div className="form-group" style={{ minWidth: 90 }}><label className="form-label" htmlFor="loc-level">Tingkat</label><input id="loc-level" type="number" min="1" max="9" className="form-input" value={form.level} onChange={set('level')} /></div>
                {form.type === 'BIN' && <div className="form-group" style={{ minWidth: 90 }}><label className="form-label" htmlFor="loc-bin">Bin</label><input id="loc-bin" type="number" min="1" max="99" className="form-input" value={form.bin} onChange={set('bin')} /></div>}
              </>
            ) : (
              <div className="form-group" style={{ minWidth: 90 }}><label className="form-label" htmlFor="loc-zone">Zona</label><input id="loc-zone" type="number" min="1" max="99" className="form-input" value={form.zone} onChange={set('zone')} /></div>
            )}
            <div className="form-group" style={{ flex: 1 }}><label className="form-label" htmlFor="loc-desc">Keterangan</label><input id="loc-desc" className="form-input" value={form.description} onChange={set('description')} placeholder="Mis. bahan kimia, APD" /></div>
            <button className="btn btn-primary" disabled={busy}><Plus aria-hidden /> Tambah {preview}</button>
          </form>
          {error && <div className="card-body"><p role="alert" className="alert alert-danger">{error}</p></div>}
        </section>
      )}

      <section className="card">
        <div className="card-header">
          <div className="card-title">{locations.length} lokasi</div>
          <Link className={`btn btn-outline ${chosen.length ? '' : 'disabled'}`} aria-disabled={!chosen.length} href={chosen.length ? '/gudang/label?' + new URLSearchParams({ lokasi: chosen.join(',') }) : '#'}>
            <QrCode aria-hidden /> Cetak label ({chosen.length})
          </Link>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="Pilih semua" checked={chosen.length === locations.length && locations.length > 0} onChange={() => setSelected(chosen.length === locations.length ? new Set() : new Set(locations.map((l) => l.code)))} /></th>
                <th>Kode</th><th>Jenis</th><th>Keterangan</th><th className="num">Jenis barang</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((l) => (
                <tr key={l.id}>
                  <td><input type="checkbox" aria-label={'Pilih ' + l.code} checked={selected.has(l.code)} onChange={() => toggle(l.code)} /></td>
                  <td className="nowrap"><Link href={'/gudang/l/' + l.code}>{l.code}</Link></td>
                  <td>{LOCATION_TYPES[l.type] ?? l.type}{l.parent && <div className="cell-sub">di {l.parent.code}</div>}</td>
                  <td>{l.description ?? '-'}</td>
                  <td className="num">{l.items}</td>
                </tr>
              ))}
              {!locations.length && <EmptyRow colSpan={5} title="Belum ada lokasi" />}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
