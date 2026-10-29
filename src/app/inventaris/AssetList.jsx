'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { Boxes, ChevronDown, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';
import { EmptyRow, StatusBadge } from '@/components/ui';
import { ASSET_CONDITION, CONDITION_TONE } from '@/lib/assets';
import { fmtDate, idr } from '@/lib/ui-labels';

const TONES = ['navy', 'green', 'blue', 'orange', 'yellow'];
const num = (v) => Number(v ?? 0).toLocaleString('id-ID');

function Condition({ value }) {
  return <StatusBadge value={value} labels={ASSET_CONDITION} tones={CONDITION_TONE} />;
}

// Rentang nomor satu kelompok pembelian, mis. PJM/MPK/XII/25/0085 – 0094.
function registerRange({ firstNo, lastNo, registers }) {
  if (registers === 1) return firstNo;
  return `${firstNo} – ${lastNo.split('/').pop()}`;
}

export default function AssetList({ summary, rows, locations, filters, showPrice }) {
  const [open, setOpen] = useState({});
  const [error, setError] = useState('');

  async function toggle(batchId) {
    if (open[batchId]) return setOpen(({ [batchId]: _, ...rest }) => rest);
    setOpen((o) => ({ ...o, [batchId]: 'loading' }));
    try {
      const res = await apiFetch('/api/inventaris/batch?' + new URLSearchParams({ batchId }));
      const units = await res.json();
      setOpen((o) => ({ ...o, [batchId]: units }));
    } catch (err) {
      setError(err.message);
      setOpen(({ [batchId]: _, ...rest }) => rest);
    }
  }

  const columns = showPrice ? 8 : 7;
  const hasAssets = summary.some((c) => c.registers > 0);

  return (
    <div className="stack">
      <div className="kpi-grid">
        {summary.map((c, i) => (
          <Link key={c.code} href={'?' + new URLSearchParams({ tab: 'daftar', kategori: c.code })} className={`kpi-card ${TONES[i % TONES.length]}`}>
            <div className="kpi-icon"><Boxes size={20} /></div>
            <div className="kpi-label">{c.name}</div>
            <div className="kpi-value">{num(c.units)}</div>
            <div className="kpi-trend">
              {num(c.registers)} nomor register{c.bookValue != null ? ` · nilai buku ${idr(c.bookValue)}` : ''}
            </div>
          </Link>
        ))}
      </div>

      <section className="card">
        <form className="card-body toolbar" style={{ alignItems: 'flex-end' }}>
          <input type="hidden" name="tab" value="daftar" />
          <div className="form-group">
            <label className="form-label" htmlFor="as-q">Cari</label>
            <input id="as-q" name="q" defaultValue={filters.q} className="form-input" placeholder="Nomor register, nama, plat, S/N" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="as-cat">Kategori</label>
            <select id="as-cat" name="kategori" defaultValue={filters.kategori} className="form-select">
              <option value="">Semua kategori</option>
              {summary.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="as-loc">Lokasi</label>
            <select id="as-loc" name="lokasi" defaultValue={filters.lokasi} className="form-select">
              <option value="">Semua lokasi</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="as-cond">Kondisi</label>
            <select id="as-cond" name="kondisi" defaultValue={filters.kondisi} className="form-select">
              <option value="">Semua kondisi</option>
              {Object.entries(ASSET_CONDITION).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <button className="btn btn-outline">Tampilkan</button>
        </form>
        {error && <div className="card-body"><p role="alert" className="alert alert-danger">{error}</p></div>}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th aria-label="Buka" />
                <th>Nomor register</th>
                <th>Aset</th>
                <th className="num">Jumlah</th>
                <th>Lokasi</th>
                <th>Kondisi</th>
                <th>Perolehan</th>
                {showPrice && <th className="num">Nilai buku</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const units = open[r.batchId];
                const expandable = r.registers > 1;
                return (
                  <Fragment key={r.batchId}>
                    <tr>
                      <td>
                        {expandable && (
                          <button type="button" className="icon-btn" onClick={() => toggle(r.batchId)} aria-expanded={Boolean(units)} aria-label={units ? 'Tutup daftar nomor' : 'Lihat setiap nomor'}>
                            {units ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </button>
                        )}
                      </td>
                      <td className="nowrap">
                        <div className="cell-title">{registerRange(r)}</div>
                        {r.registers > 1 && <div className="cell-sub">{num(r.registers)} nomor</div>}
                      </td>
                      <td style={{ minWidth: 220 }}>
                        <div className="cell-title">{r.name}</div>
                        <div className="cell-sub">{[r.brandSpec, r.identifier].filter(Boolean).join(' · ') || '-'}</div>
                        {r.notes && <div className="cell-sub">{r.notes}</div>}
                      </td>
                      <td className="num nowrap">{num(r.units)} {r.unit ?? ''}</td>
                      <td>
                        <div>{r.location}</div>
                        {r.area && <div className="cell-sub">{r.area}</div>}
                      </td>
                      <td><Condition value={r.condition} /></td>
                      <td className="nowrap">{r.acquiredAt ? fmtDate(r.acquiredAt) : '-'}</td>
                      {showPrice && (
                        <td className="num nowrap">
                          <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{r.bookValue == null ? '-' : idr(r.bookValue)}</div>
                          {r.unitPrice != null && <div className="cell-sub">{idr(r.unitPrice)} / unit · {Number(r.depreciationRate ?? 0) * 100} %/th</div>}
                        </td>
                      )}
                    </tr>
                    {units === 'loading' && (
                      <tr><td /><td colSpan={columns - 1} className="muted">Memuat nomor register…</td></tr>
                    )}
                    {Array.isArray(units) && units.map((u) => (
                      <tr key={u.id} style={{ background: 'var(--gray-50)' }}>
                        <td />
                        <td className="nowrap">{u.registerNo}</td>
                        <td>
                          <div className="cell-sub">{[u.identifier, u.notes].filter(Boolean).join(' · ') || '-'}</div>
                          {u.damagedYear && <div className="cell-sub">Rusak sejak {u.damagedYear}</div>}
                        </td>
                        <td className="num">{num(u.quantity)}</td>
                        <td>
                          <div>{u.location.name}</div>
                          {u.area && <div className="cell-sub">{u.area}</div>}
                        </td>
                        <td><Condition value={u.condition} /></td>
                        <td colSpan={showPrice ? 2 : 1} />
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
              {!rows.length && (
                <EmptyRow
                  colSpan={columns}
                  title={hasAssets ? 'Tidak ada aset untuk filter ini' : 'Register aset masih kosong'}
                  hint={hasAssets ? 'Ubah atau kosongkan filter.' : 'Admin aset dapat meng-import register Excel di sub-menu Import register.'}
                />
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
