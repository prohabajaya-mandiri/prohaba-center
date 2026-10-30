'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Plus, Printer } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';
import { EmptyRow, Modal, PrintDoc, printDocument } from '@/components/ui';
import { DOC_TYPES, fmtQty } from '@/lib/stock';
import { fmtDate, idr } from '@/lib/ui-labels';
import TransactionForm from './TransactionForm';

const typeLabel = (t) => DOC_TYPES[t]?.label ?? t;
const PRINT_TITLE = { KELUAR: 'SURAT JALAN', MASUK: 'BUKTI BARANG MASUK', RETUR: 'BUKTI RETUR BARANG', PINDAH: 'BUKTI PINDAH LOKASI', SALDO_AWAL: 'SALDO AWAL GUDANG' };

function target(doc) {
  if (doc.project) return `${doc.project.code} — ${doc.project.name}`;
  return doc.destination ?? '-';
}

function PrintedDocument({ doc }) {
  const total = doc.movements.reduce((s, m) => s + Math.abs(Number(m.qty)) * Number(m.unitCost), 0);
  const lines = doc.type === 'PINDAH' ? doc.movements.filter((m) => Number(m.qty) < 0) : doc.movements;
  return (
    <PrintDoc>
      <div className="print-doc-head">
        <div className="print-doc-brand">
          <img src="/brand/prohaba-logo.png" alt="" />
          <div><strong>PT. Prohaba Jaya Mandiri</strong>Gudang HO</div>
        </div>
        <div className="print-doc-title">
          <h1>{PRINT_TITLE[doc.type]}</h1>
          <p>{doc.number}</p>
        </div>
      </div>
      <div className="print-doc-parties">
        <div>
          <div className="print-doc-label">{doc.type === 'MASUK' ? 'Asal barang' : doc.type === 'RETUR' ? 'Dari proyek' : 'Tujuan'}</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{target(doc)}</div>
          {doc.project?.location && <div>{doc.project.location}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="print-doc-label">Tanggal</div>
          <div>{fmtDate(doc.docDate, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          {(doc.vehicleNo || doc.driverName) && (
            <>
              <div className="print-doc-label" style={{ marginTop: 8 }}>Kendaraan / sopir</div>
              <div>{[doc.vehicleNo, doc.driverName].filter(Boolean).join(' · ')}</div>
            </>
          )}
        </div>
      </div>
      <table>
        <thead>
          <tr><th>No</th><th>SKU</th><th>Nama barang</th><th className="num">Jumlah</th><th>Lokasi</th></tr>
        </thead>
        <tbody>
          {lines.map((m, i) => (
            <tr key={m.id}>
              <td>{i + 1}</td>
              <td>{m.item.sku}</td>
              <td>{m.item.name}{m.item.spec ? ` (${m.item.spec})` : ''}</td>
              <td className="num">{fmtQty(Math.abs(Number(m.qty)))} {m.item.unit}</td>
              <td>{m.location.code}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {doc.type !== 'KELUAR' && doc.type !== 'PINDAH' && <p>Nilai: {idr(total)}</p>}
      {doc.notes && <p>Catatan: {doc.notes}</p>}
      <div className="print-doc-signs">
        <div><div className="line" />Dikeluarkan oleh<br />{doc.createdBy.name}</div>
        {doc.type === 'KELUAR' && <div><div className="line" />Pengangkut<br />{doc.driverName ?? ''}</div>}
        <div><div className="line" />{doc.type === 'KELUAR' ? 'Diterima oleh' : 'Mengetahui'}<br />{doc.taker?.name ?? doc.takerName ?? ''}</div>
      </div>
    </PrintDoc>
  );
}

function DocumentDetail({ doc, isTop, onClose }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cancelled = doc.status === 'DIBATALKAN';

  async function cancel() {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/gudang/documents/${doc.id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
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
      title={`${doc.number} · ${typeLabel(doc.type)}`}
      subtitle={`${fmtDate(doc.docDate)} · dicatat ${doc.createdBy.name}`}
      size="modal-lg"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          {!cancelled && (
            <button type="button" className="btn btn-outline" onClick={printDocument}>
              <Printer aria-hidden /> Cetak {doc.type === 'KELUAR' ? 'surat jalan' : 'bukti'}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose}>Tutup</button>
        </>
      }
    >
      <div className="stack">
        {cancelled && <p className="alert alert-warning"><Ban aria-hidden /><span>Dibatalkan: {doc.cancelReason}. Tidak dihitung di stok.</span></p>}
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        <div className="form-grid">
          <div><div className="form-label">{doc.type === 'MASUK' ? 'Asal' : doc.type === 'RETUR' ? 'Dari proyek' : 'Tujuan'}</div>{target(doc)}</div>
          <div><div className="form-label">Pengambil</div>{doc.taker?.name ?? doc.takerName ?? '-'}</div>
          {(doc.vehicleNo || doc.driverName) && <div><div className="form-label">Kendaraan / sopir</div>{[doc.vehicleNo, doc.driverName].filter(Boolean).join(' · ')}</div>}
          {doc.notes && <div><div className="form-label">Catatan</div>{doc.notes}</div>}
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Barang</th><th>Lokasi</th><th className="num">Jumlah</th><th className="num">Harga</th></tr></thead>
            <tbody>
              {doc.movements.map((m) => (
                <tr key={m.id}>
                  <td><div className="cell-title">{m.item.sku}</div><div className="cell-sub">{m.item.name}</div></td>
                  <td>{m.location.code}</td>
                  <td className="num nowrap" style={{ color: Number(m.qty) < 0 ? 'var(--red-600)' : 'var(--green-700)' }}>{Number(m.qty) > 0 ? '+' : ''}{fmtQty(m.qty)} {m.item.unit}</td>
                  <td className="num nowrap">{idr(m.unitCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isTop && !cancelled && doc.type !== 'SALDO_AWAL' && (
          <div className="toolbar" style={{ alignItems: 'flex-end' }}>
            <label style={{ flex: 1 }}>
              <span className="form-label">Batalkan dokumen (alasan wajib)</span>
              <input className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Mis. salah input jumlah" />
            </label>
            <button type="button" className="btn btn-danger" onClick={cancel} disabled={busy || !reason.trim()}>
              <Ban aria-hidden /> Batalkan
            </button>
          </div>
        )}
      </div>
      {!cancelled && <PrintedDocument doc={doc} />}
    </Modal>
  );
}

export default function DocumentList({ rows, filters, items, locations, projects, canEdit, isTop }) {
  const [detail, setDetail] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function open(id) {
    setError('');
    try {
      const res = await apiFetch('/api/gudang/documents/' + id);
      setDetail(await res.json());
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <form className="toolbar" style={{ alignItems: 'flex-end' }}>
        <input type="hidden" name="tab" value="transaksi" />
        <div className="form-group">
          <label className="form-label" htmlFor="doc-type">Jenis</label>
          <select id="doc-type" name="jenis" defaultValue={filters.type} className="form-select">
            <option value="">Semua jenis</option>
            {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="doc-project">Proyek</label>
          <select id="doc-project" name="proyek" defaultValue={filters.projectId} className="form-select">
            <option value="">Semua proyek</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        <button className="btn btn-outline">Tampilkan</button>
        <span className="spacer" />
        {canEdit && items.length > 0 && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus aria-hidden /> Transaksi baru</button>
        )}
      </form>
      {error && <p role="alert" className="alert alert-danger">{error}</p>}
      <section className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Nomor</th><th>Tanggal</th><th>Jenis</th><th>Tujuan / asal</th><th className="num">Barang</th><th>Dicatat</th></tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="clickable" onClick={() => open(d.id)}>
                  <td className="nowrap">
                    <div className="cell-title">{d.number}</div>
                    {d.status === 'DIBATALKAN' && <span className="badge badge-danger">Dibatalkan</span>}
                  </td>
                  <td className="nowrap">{fmtDate(d.docDate)}</td>
                  <td>{typeLabel(d.type)}</td>
                  <td>{target(d)}{d.takerName && <div className="cell-sub">Pengambil: {d.takerName}</div>}</td>
                  <td className="num">{d.type === 'PINDAH' ? d._count.movements / 2 : d._count.movements}</td>
                  <td>{d.createdBy.name}</td>
                </tr>
              ))}
              {!rows.length && <EmptyRow colSpan={6} title="Belum ada transaksi" />}
            </tbody>
          </table>
        </div>
      </section>
      {detail && <DocumentDetail doc={detail} isTop={isTop} onClose={() => setDetail(null)} />}
      {creating && (
        <TransactionForm
          items={items}
          locations={locations}
          projects={projects}
          onClose={() => setCreating(false)}
          onSaved={(doc) => { setCreating(false); open(doc.id); }}
        />
      )}
    </div>
  );
}
