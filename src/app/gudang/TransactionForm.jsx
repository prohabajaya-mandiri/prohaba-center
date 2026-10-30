'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch, businessToday } from '@/lib/client-api';
import { Modal } from '@/components/ui';
import { DOC_TYPES, ENTRY_TYPES, fmtQty } from '@/lib/stock';

const HINT = {
  MASUK: 'Barang diterima ke gudang (pembelian, kiriman dari site, dan lainnya). Harga satuan menentukan harga rata-rata.',
  KELUAR: 'Barang dikeluarkan ke proyek atau tujuan lain. Dinilai dengan harga rata-rata; stok di lokasi asal tidak boleh minus.',
  RETUR: 'Barang dikembalikan dari proyek ke gudang, dinilai dengan harga rata-rata saat ini.',
  PINDAH: 'Barang dipindah antar lokasi di gudang. Jumlah stok tidak berubah.',
};

const emptyLine = () => ({ key: Math.random(), itemId: '', search: '', locationId: '', toLocationId: '', qty: '', unitCost: '' });

/** Form dokumen masuk / keluar / retur / pindah. `initial` mengisi barang yang dipilih dari daftar stok. */
export default function TransactionForm({ items, locations, projects, initialType = 'KELUAR', initialItems = [], onClose, onSaved }) {
  const router = useRouter();
  const [type, setType] = useState(initialType);
  const [header, setHeader] = useState({ docDate: businessToday(), projectId: '', destination: '', takerName: '', vehicleNo: '', driverName: '', notes: '' });
  const [lines, setLines] = useState(() =>
    initialItems.length
      ? initialItems.map((i) => ({ ...emptyLine(), itemId: i.id, search: `${i.sku} — ${i.name}`, locationId: i.locations[0]?.locationId ?? i.homeLocationId ?? '', unitCost: String(Number(i.avgCost) || '') }))
      : [emptyLine()],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const byLabel = useMemo(() => new Map(items.map((i) => [`${i.sku} — ${i.name}`, i])), [items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const locationCode = (id) => locations.find((l) => l.id === id)?.code ?? '';
  const outgoing = type === 'KELUAR' || type === 'PINDAH';

  const set = (k) => (e) => setHeader((h) => ({ ...h, [k]: e.target.value }));
  const setLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function pickItem(line, value) {
    const item = byLabel.get(value);
    if (!item) return setLine(line.key, { search: value, itemId: '' });
    setLine(line.key, {
      search: value,
      itemId: item.id,
      locationId: (outgoing ? item.locations[0]?.locationId : item.homeLocationId) ?? item.locations[0]?.locationId ?? '',
      unitCost: String(Number(item.avgCost) || ''),
    });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = {
        type,
        docDate: header.docDate,
        notes: header.notes || null,
        ...(type === 'MASUK' && { destination: header.destination || null }),
        ...(type === 'KELUAR' && { projectId: header.projectId || null, destination: header.destination || null, takerName: header.takerName || null, vehicleNo: header.vehicleNo || null, driverName: header.driverName || null }),
        ...(type === 'RETUR' && { projectId: header.projectId || null, takerName: header.takerName || null }),
        lines: lines.map((l) => ({
          itemId: l.itemId,
          locationId: l.locationId,
          qty: l.qty,
          ...(type === 'PINDAH' && { toLocationId: l.toLocationId }),
          ...(type === 'MASUK' && { unitCost: l.unitCost || 0 }),
        })),
      };
      if (lines.some((l) => !l.itemId)) throw new Error('Pilih barang dari daftar di setiap baris.');
      const res = await apiFetch('/api/gudang/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const doc = await res.json();
      router.refresh();
      onSaved?.(doc);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Transaksi gudang"
      subtitle={HINT[type]}
      size="modal-xl"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Batal</button>
          <button type="submit" form="stock-tx" className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </>
      }
    >
      <form id="stock-tx" onSubmit={submit} className="stack">
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        <datalist id="stock-items">
          {items.filter((i) => i.isActive).map((i) => <option key={i.id} value={`${i.sku} — ${i.name}`} />)}
        </datalist>
        <div className="form-grid">
          <label>
            <span className="form-label required">Jenis</span>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
              {ENTRY_TYPES.map((t) => <option key={t} value={t}>{DOC_TYPES[t].label}</option>)}
            </select>
          </label>
          <label>
            <span className="form-label required">Tanggal</span>
            <input type="date" className="form-input" value={header.docDate} max={businessToday()} onChange={set('docDate')} required />
          </label>
          {(type === 'KELUAR' || type === 'RETUR') && (
            <label>
              <span className={`form-label ${type === 'RETUR' ? 'required' : ''}`}>{type === 'RETUR' ? 'Dari proyek' : 'Proyek tujuan'}</span>
              <select className="form-select" value={header.projectId} onChange={set('projectId')} required={type === 'RETUR'}>
                <option value="">{type === 'RETUR' ? 'Pilih proyek' : 'Bukan proyek (isi tujuan lain)'}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </label>
          )}
          {(type === 'MASUK' || (type === 'KELUAR' && !header.projectId)) && (
            <label>
              <span className={`form-label ${type === 'KELUAR' ? 'required' : ''}`}>{type === 'MASUK' ? 'Asal barang' : 'Tujuan lain'}</span>
              <input className="form-input" value={header.destination} onChange={set('destination')} placeholder={type === 'MASUK' ? 'Mis. PO-2026-000012, toko, retur site' : 'Mis. Workshop KM 19, Mess HO'} required={type === 'KELUAR'} />
            </label>
          )}
          {(type === 'KELUAR' || type === 'RETUR') && (
            <label>
              <span className={`form-label ${type === 'KELUAR' ? 'required' : ''}`}>{type === 'KELUAR' ? 'Pengambil' : 'Yang mengembalikan'}</span>
              <input className="form-input" value={header.takerName} onChange={set('takerName')} placeholder="Nama lengkap" required={type === 'KELUAR'} />
            </label>
          )}
          {type === 'KELUAR' && (
            <>
              <label>
                <span className="form-label">Nomor kendaraan</span>
                <input className="form-input" value={header.vehicleNo} onChange={set('vehicleNo')} />
              </label>
              <label>
                <span className="form-label">Sopir</span>
                <input className="form-input" value={header.driverName} onChange={set('driverName')} />
              </label>
            </>
          )}
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 380 }}>Barang</th>
                <th>{type === 'PINDAH' ? 'Dari lokasi' : type === 'KELUAR' ? 'Ambil dari' : 'Simpan di'}</th>
                {type === 'PINDAH' && <th>Ke lokasi</th>}
                <th className="num">Jumlah</th>
                {type === 'MASUK' && <th className="num">Harga satuan</th>}
                <th aria-label="Hapus" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const item = byId.get(l.itemId);
                const options = outgoing && item ? item.locations.map((x) => ({ id: x.locationId, label: `${locationCode(x.locationId)} (${fmtQty(x.qty)})` })) : locations.map((x) => ({ id: x.id, label: x.code }));
                return (
                  <tr key={l.key}>
                    <td>
                      <input className="form-input" list="stock-items" value={l.search} onChange={(e) => pickItem(l, e.target.value)} placeholder="Ketik SKU atau nama" aria-label="Barang" />
                      {item && <div className="cell-sub">Stok {fmtQty(item.qty)} {item.unit}</div>}
                    </td>
                    <td>
                      <select className="form-select" value={l.locationId} onChange={(e) => setLine(l.key, { locationId: e.target.value })} aria-label="Lokasi">
                        <option value="">Pilih</option>
                        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    </td>
                    {type === 'PINDAH' && (
                      <td>
                        <select className="form-select" value={l.toLocationId} onChange={(e) => setLine(l.key, { toLocationId: e.target.value })} aria-label="Lokasi tujuan">
                          <option value="">Pilih</option>
                          {locations.filter((x) => x.id !== l.locationId).map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}
                        </select>
                      </td>
                    )}
                    <td className="num" style={{ width: 120 }}>
                      <input className="form-input" type="number" min="0" step={item?.decimals ? '0.001' : '1'} value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} aria-label="Jumlah" required />
                    </td>
                    {type === 'MASUK' && (
                      <td className="num" style={{ minWidth: 140 }}>
                        <input className="form-input" type="number" min="0" step="0.01" value={l.unitCost} onChange={(e) => setLine(l.key, { unitCost: e.target.value })} aria-label="Harga satuan" />
                      </td>
                    )}
                    <td>
                      <button type="button" className="icon-btn" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))} aria-label="Hapus baris">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setLines((ls) => [...ls, emptyLine()])}>
          <Plus aria-hidden /> Tambah barang
        </button>
        <label>
          <span className="form-label">Catatan</span>
          <input className="form-input" value={header.notes} onChange={set('notes')} />
        </label>
      </form>
    </Modal>
  );
}
