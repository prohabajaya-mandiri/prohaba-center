'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Pencil, QrCode, Warehouse } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';
import { EmptyRow, Modal, SearchField } from '@/components/ui';
import { fmtQty } from '@/lib/stock';
import { idr } from '@/lib/ui-labels';
import TransactionForm from './TransactionForm';

const STATUS = [
  ['', 'Semua barang'],
  ['ada', 'Ada stok'],
  ['minimum', 'Di bawah minimum'],
  ['kosong', 'Stok 0'],
  ['nonaktif', 'Nonaktif'],
];

function ItemEdit({ item, locations, onClose }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: item.name,
    spec: item.spec ?? '',
    minStock: item.minStock ?? '',
    homeLocationId: item.homeLocationId ?? '',
    isActive: item.isActive,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/gudang/items/' + item.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, spec: form.spec || null, homeLocationId: form.homeLocationId || null }),
      });
      router.refresh();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={item.sku}
      subtitle="Ubah data barang. Jumlah stok hanya berubah lewat transaksi."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Batal</button>
          <button type="submit" form="item-edit" className="btn btn-primary" disabled={busy}>Simpan</button>
        </>
      }
    >
      <form id="item-edit" onSubmit={save} className="stack">
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        <label><span className="form-label required">Nama barang</span><input className="form-input" value={form.name} onChange={set('name')} required /></label>
        <label><span className="form-label">Spesifikasi / merek</span><input className="form-input" value={form.spec} onChange={set('spec')} /></label>
        <div className="form-grid">
          <label><span className="form-label">Stok minimum ({item.unit})</span><input type="number" min="0" step="any" className="form-input" value={form.minStock} onChange={set('minStock')} /></label>
          <label>
            <span className="form-label">Lokasi utama</span>
            <select className="form-select" value={form.homeLocationId} onChange={set('homeLocationId')}>
              <option value="">Belum ditentukan</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
            </select>
          </label>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={form.isActive} onChange={set('isActive')} /> Barang aktif
        </label>
      </form>
    </Modal>
  );
}

export default function StockList({ items, locations, projects, canEdit }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [editing, setEditing] = useState(null);
  const [tx, setTx] = useState(null);

  const groups = useMemo(() => [...new Map(items.map((i) => [i.groupCode, i.group.name])).entries()], [items]);
  const shown = items.filter((i) => {
    if (group && i.groupCode !== group) return false;
    if (status === 'nonaktif') { if (i.isActive) return false; } else if (!i.isActive) return false;
    if (status === 'ada' && !(i.qty > 0)) return false;
    if (status === 'kosong' && i.qty !== 0) return false;
    if (status === 'minimum' && !(i.minStock != null && i.qty < Number(i.minStock))) return false;
    if (q) {
      const t = q.toLowerCase();
      if (![i.sku, i.name, i.spec, i.homeLocation?.code].some((v) => v?.toLowerCase().includes(t))) return false;
    }
    return true;
  });
  const total = shown.reduce((s, i) => s + i.value, 0);
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShown = shown.length > 0 && shown.every((i) => selected.has(i.id));
  const chosen = items.filter((i) => selected.has(i.id));
  const labelHref = '/gudang/label?' + new URLSearchParams({ barang: chosen.map((i) => i.sku).join(',') });

  if (!items.length) {
    return (
      <section className="card">
        <div className="card-body">
          <p className="alert alert-info"><Warehouse aria-hidden /><span>Belum ada barang. {canEdit ? 'Mulai dengan sub-menu Import saldo awal dari laporan opname terakhir.' : 'Admin gudang belum meng-import saldo awal.'}</span></p>
        </div>
      </section>
    );
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <SearchField value={q} onChange={setQ} placeholder="SKU, nama, lokasi" />
        <select className="form-select" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Kelompok" style={{ maxWidth: 260 }}>
          <option value="">Semua kelompok</option>
          {groups.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
        <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status stok" style={{ maxWidth: 200 }}>
          {STATUS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <span className="spacer" />
        {chosen.length > 0 && (
          <Link className="btn btn-outline" href={labelHref}><QrCode aria-hidden /> Label ({chosen.length})</Link>
        )}
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => setTx({ type: chosen.length ? 'KELUAR' : 'MASUK', items: chosen })}>
            <ArrowLeftRight aria-hidden /> Transaksi{chosen.length ? ` (${chosen.length} barang)` : ''}
          </button>
        )}
      </div>

      <section className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="Pilih semua" checked={allShown} onChange={() => setSelected(allShown ? new Set() : new Set(shown.map((i) => i.id)))} /></th>
                <th>SKU</th>
                <th>Barang</th>
                <th className="num">Stok</th>
                <th>Lokasi</th>
                <th className="num">Harga rata-rata</th>
                <th className="num">Nilai</th>
                {canEdit && <th aria-label="Ubah" />}
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => {
                const low = i.minStock != null && i.qty < Number(i.minStock);
                return (
                  <tr key={i.id}>
                    <td><input type="checkbox" aria-label={'Pilih ' + i.sku} checked={selected.has(i.id)} onChange={() => toggle(i.id)} /></td>
                    <td className="nowrap"><Link href={'/gudang/b/' + i.sku}>{i.sku}</Link></td>
                    <td style={{ minWidth: 240 }}>
                      <div className="cell-title">{i.name}</div>
                      <div className="cell-sub">{[i.group.name, i.spec].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="num nowrap">
                      <span style={{ fontWeight: 600, color: low ? 'var(--red-600)' : 'var(--gray-900)' }}>{fmtQty(i.qty)}</span> {i.unit}
                      {low && <div className="cell-sub">min. {fmtQty(i.minStock)}</div>}
                    </td>
                    <td className="nowrap">
                      {i.locations.length
                        ? i.locations.map((l) => <div key={l.locationId}>{locations.find((x) => x.id === l.locationId)?.code} <span className="muted">({fmtQty(l.qty)})</span></div>)
                        : <span className="muted">{i.homeLocation?.code ?? '-'}</span>}
                    </td>
                    <td className="num nowrap">{idr(i.avgCost)}</td>
                    <td className="num nowrap">{idr(i.value)}</td>
                    {canEdit && (
                      <td>
                        <button type="button" className="action-btn" onClick={() => setEditing(i)} aria-label={'Ubah ' + i.sku}><Pencil /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!shown.length && <EmptyRow colSpan={canEdit ? 8 : 7} title="Tidak ada barang untuk filter ini" />}
            </tbody>
            {shown.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={6} className="num" style={{ fontWeight: 600 }}>Total nilai {shown.length} barang</td>
                  <td className="num nowrap" style={{ fontWeight: 600 }}>{idr(total)}</td>
                  {canEdit && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {editing && <ItemEdit item={editing} locations={locations} onClose={() => setEditing(null)} />}
      {tx && (
        <TransactionForm
          items={items}
          locations={locations}
          projects={projects}
          initialType={tx.type}
          initialItems={tx.items}
          onClose={() => setTx(null)}
          onSaved={() => { setTx(null); setSelected(new Set()); }}
        />
      )}
    </div>
  );
}

