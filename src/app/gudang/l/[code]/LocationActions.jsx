'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, CheckCircle2, PackageMinus, PackagePlus, ScanLine, ShoppingBasket } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';
import { Modal } from '@/components/ui';
import { feedback } from '@/components/field/offline';
import { HOLDING_LOCATION, LOCATION_TYPES, fmtQty } from '@/lib/stock';
import { useBasket } from '../../basket';

const NEW_STOCK = 'BARU';

/** Lembar aksi untuk satu barang di rak ini: ambil (ke keranjang) atau pindah ke lokasi lain. */
function ItemSheet({ mode, item, location, locations, onClose, onDone }) {
  const { add } = useBasket();
  const [qty, setQty] = useState(mode === 'ambil' ? '1' : String(item.qty));
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const step = item.decimals ? '0.001' : '1';

  async function submit(e) {
    e.preventDefault();
    const n = Number(qty);
    if (!(n > 0) || n > item.qty) return setError(`Jumlah 1–${fmtQty(item.qty)} ${item.unit}.`);
    if (mode === 'ambil') {
      add({ itemId: item.id, sku: item.sku, name: item.name, unit: item.unit, decimals: item.decimals, locationId: location.id, locationCode: location.code, qty: n, available: item.qty });
      feedback(true);
      return onDone(`${fmtQty(n)} ${item.unit} ${item.name} masuk keranjang.`);
    }
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/gudang/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'PINDAH', lines: [{ itemId: item.id, locationId: location.id, toLocationId: to, qty: n, setHome: true }] }),
      });
      feedback(true);
      onDone(`${fmtQty(n)} ${item.unit} dipindah ke ${locations.find((l) => l.id === to)?.code}.`);
    } catch (err) {
      feedback(false);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={mode === 'ambil' ? 'Ambil barang' : 'Pindah ke lokasi lain'}
      subtitle={`${item.sku} · ${item.name} · stok di ${location.code}: ${fmtQty(item.qty)} ${item.unit}`}
      onClose={onClose}
      busy={busy}
      footer={<button type="submit" form="item-sheet" className="btn btn-primary btn-block" disabled={busy}>{mode === 'ambil' ? 'Masukkan ke keranjang' : busy ? 'Memindahkan…' : 'Pindahkan'}</button>}
    >
      <form id="item-sheet" onSubmit={submit} className="stack">
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        <label>
          <span className="form-label required">Jumlah ({item.unit})</span>
          <input className="form-input" type="number" inputMode="decimal" min="0" step={step} max={item.qty} value={qty} onChange={(e) => setQty(e.target.value)} onFocus={(e) => e.target.select()} autoFocus required />
        </label>
        {mode === 'pindah' && (
          <label>
            <span className="form-label required">Ke lokasi</span>
            <select className="form-select" value={to} onChange={(e) => setTo(e.target.value)} required>
              <option value="">Pilih lokasi</option>
              {locations.filter((l) => l.id !== location.id).map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
            </select>
          </label>
        )}
      </form>
    </Modal>
  );
}

/** Menyimpan barang ke rak ini: dari lokasi lain (penataan / pindah) atau barang baru masuk. */
function StoreSheet({ location, items, locations, onClose, onDone }) {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [origin, setOrigin] = useState('');
  const [setHome, setSetHome] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const byLabel = useMemo(() => new Map(items.map((i) => [`${i.sku} — ${i.name}`, i])), [items]);
  const item = byLabel.get(search);
  const code = (id) => locations.find((l) => l.id === id)?.code ?? '';
  const sources = (item?.locations ?? []).filter((l) => l.locationId !== location.id && l.qty > 0);
  const from = sources.find((l) => l.locationId === source);

  function pick(value) {
    setSearch(value);
    const next = byLabel.get(value);
    const best = (next?.locations ?? []).filter((l) => l.locationId !== location.id && l.qty > 0).sort((a, b) => b.qty - a.qty)[0];
    setSource(best?.locationId ?? NEW_STOCK);
    setQty(best ? String(best.qty) : '');
    setUnitCost(next ? String(Number(next.avgCost) || '') : '');
  }

  async function submit(e) {
    e.preventDefault();
    if (!item) return setError('Pilih barang dari daftar.');
    setBusy(true);
    setError('');
    try {
      const body = source === NEW_STOCK
        ? { type: 'MASUK', destination: origin || null, lines: [{ itemId: item.id, locationId: location.id, qty, unitCost: unitCost || 0, setHome }] }
        : { type: 'PINDAH', lines: [{ itemId: item.id, locationId: source, toLocationId: location.id, qty, setHome }] };
      await apiFetch('/api/gudang/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      feedback(true);
      onDone(`${fmtQty(qty)} ${item.unit} ${item.name} disimpan di ${location.code}.`);
    } catch (err) {
      feedback(false);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Simpan barang di ${location.code}`}
      subtitle="Penataan dari penampung/rak lain, atau barang baru masuk gudang."
      onClose={onClose}
      busy={busy}
      footer={<button type="submit" form="store-sheet" className="btn btn-primary btn-block" disabled={busy || !item}>{busy ? 'Menyimpan…' : 'Simpan di rak ini'}</button>}
    >
      <form id="store-sheet" onSubmit={submit} className="stack">
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        <datalist id="store-items">{items.map((i) => <option key={i.id} value={`${i.sku} — ${i.name}`} />)}</datalist>
        <label>
          <span className="form-label required">Barang</span>
          <input className="form-input" list="store-items" value={search} onChange={(e) => pick(e.target.value)} placeholder="Ketik nama atau SKU" autoFocus />
        </label>
        {item && (
          <>
            <label>
              <span className="form-label required">Diambil dari</span>
              <select className="form-select" value={source} onChange={(e) => { setSource(e.target.value); const s = sources.find((l) => l.locationId === e.target.value); if (s) setQty(String(s.qty)); }}>
                {sources.map((l) => <option key={l.locationId} value={l.locationId}>{code(l.locationId)} — stok {fmtQty(l.qty)} {item.unit}</option>)}
                <option value={NEW_STOCK}>Barang baru masuk gudang (pembelian / kiriman)</option>
              </select>
            </label>
            <label>
              <span className="form-label required">Jumlah ({item.unit})</span>
              <input className="form-input" type="number" inputMode="decimal" min="0" step={item.decimals ? '0.001' : '1'} max={from?.qty} value={qty} onChange={(e) => setQty(e.target.value)} onFocus={(e) => e.target.select()} required />
            </label>
            {source === NEW_STOCK && (
              <div className="form-grid">
                <label><span className="form-label">Harga satuan</span><input className="form-input" type="number" inputMode="decimal" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></label>
                <label><span className="form-label">Asal barang</span><input className="form-input" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="No. PO / toko" /></label>
              </div>
            )}
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={setHome} onChange={(e) => setSetHome(e.target.checked)} /> Jadikan {location.code} lokasi utama barang ini
            </label>
          </>
        )}
      </form>
    </Modal>
  );
}

export default function LocationActions({ location, contents, canEdit, items, locations }) {
  const router = useRouter();
  const { lines } = useBasket();
  const [sheet, setSheet] = useState(null);
  const [message, setMessage] = useState('');
  const holding = location.code === HOLDING_LOCATION;

  const done = (text) => {
    setSheet(null);
    setMessage(text);
    router.refresh();
  };

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title" style={{ fontSize: 22 }}>{location.code}</div>
            <div className="card-subtitle">
              {[LOCATION_TYPES[location.type], location.description].filter(Boolean).join(' · ')}
              {location.parent && <> · di <Link href={'/gudang/l/' + location.parent.code}>{location.parent.code}</Link></>}
            </div>
          </div>
          <Link className="btn btn-outline" href="/gudang?tab=scan"><ScanLine aria-hidden /> Scan rak lain</Link>
        </div>
        {location.children.length > 0 && (
          <div className="card-body">Bin di rak ini: {location.children.map((c, i) => <span key={c.id}>{i ? ', ' : ''}<Link href={'/gudang/l/' + c.code}>{c.code}</Link></span>)}</div>
        )}
        {canEdit && (
          <div className="card-body" style={{ display: 'grid', gap: 10 }}>
            {message && <p role="status" className="alert alert-success" style={{ margin: 0 }}><CheckCircle2 aria-hidden /><span>{message}</span></p>}
            {!holding && (
              <button type="button" className="btn btn-primary btn-block" onClick={() => { setMessage(''); setSheet({ mode: 'simpan' }); }}>
                <PackagePlus aria-hidden /> Simpan barang di rak ini
              </button>
            )}
            {lines.length > 0 && (
              <Link className="btn btn-outline btn-block" href="/gudang?tab=scan">
                <ShoppingBasket aria-hidden /> Keranjang ({lines.length}) · buat surat jalan
              </Link>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-header"><div className="card-title">Isi lokasi ({contents.length} barang)</div></div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Barang</th><th className="num">Jumlah</th>{canEdit && <th aria-label="Aksi" />}</tr></thead>
            <tbody>
              {contents.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={'/gudang/b/' + i.sku} className="cell-title">{i.name}</Link>
                    <div className="cell-sub">{[i.sku, i.spec].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="num nowrap" style={{ fontWeight: 600 }}>{fmtQty(i.qty)} {i.unit}</td>
                  {canEdit && (
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => { setMessage(''); setSheet({ mode: 'ambil', item: i }); }}><PackageMinus aria-hidden /> Ambil</button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => { setMessage(''); setSheet({ mode: 'pindah', item: i }); }}><ArrowLeftRight aria-hidden /> Pindah</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!contents.length && <tr><td colSpan={canEdit ? 3 : 2} className="cell-empty">Lokasi ini kosong{canEdit && !holding ? '. Tekan “Simpan barang di rak ini” untuk menata barang ke sini.' : ''}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {sheet?.mode === 'simpan' && <StoreSheet location={location} items={items} locations={locations} onClose={() => setSheet(null)} onDone={done} />}
      {(sheet?.mode === 'ambil' || sheet?.mode === 'pindah') && (
        <ItemSheet mode={sheet.mode} item={sheet.item} location={location} locations={locations} onClose={() => setSheet(null)} onDone={done} />
      )}
    </div>
  );
}
