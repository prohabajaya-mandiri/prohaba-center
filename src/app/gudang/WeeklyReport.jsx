'use client';

import { Fragment } from 'react';
import { Download, Printer } from 'lucide-react';
import { EmptyRow, PrintDoc, printDocument } from '@/components/ui';
import { fmtQty } from '@/lib/stock';
import { fmtDate, idr } from '@/lib/ui-labels';

function ReportTable({ rows }) {
  const groups = [...new Map(rows.map((r) => [r.groupCode, r.group])).entries()];
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Nama barang</th>
          <th>Sat</th>
          <th className="num">Stok minggu lalu</th>
          <th className="num">Masuk</th>
          <th className="num">Keluar</th>
          <th className="num">Stok akhir</th>
          <th className="num">Harga rata-rata</th>
          <th className="num">Nilai</th>
        </tr>
      </thead>
      <tbody>
        {groups.map(([code, name]) => (
          <Fragment key={code}>
            <tr><td colSpan={9} style={{ fontWeight: 600, background: 'var(--gray-50)' }}>{name}</td></tr>
            {rows.filter((r) => r.groupCode === code).map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{r.sku}</td>
                <td>{r.name}</td>
                <td>{r.unit}</td>
                <td className="num">{fmtQty(r.opening)}</td>
                <td className="num">{r.inQty ? fmtQty(r.inQty) : ''}</td>
                <td className="num">{r.outQty ? fmtQty(r.outQty) : ''}</td>
                <td className="num" style={{ fontWeight: 600 }}>{fmtQty(r.closing)}</td>
                <td className="num nowrap">{idr(r.avgCost)}</td>
                <td className="num nowrap">{idr(r.value)}</td>
              </tr>
            ))}
          </Fragment>
        ))}
        {!rows.length && <EmptyRow colSpan={9} title="Belum ada barang" />}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr><td colSpan={8} className="num" style={{ fontWeight: 600 }}>JUMLAH TOTAL</td><td className="num nowrap" style={{ fontWeight: 600 }}>{idr(total)}</td></tr>
        </tfoot>
      )}
    </table>
  );
}

export default function WeeklyReport({ day, start, end, rows }) {
  const last = new Date(new Date(end).getTime() - 86400000);
  const period = `${fmtDate(start)} – ${fmtDate(last)}`;
  const moved = rows.filter((r) => r.inQty || r.outQty).length;
  return (
    <div className="stack">
      <form className="toolbar" style={{ alignItems: 'flex-end' }}>
        <input type="hidden" name="tab" value="laporan" />
        <div className="form-group">
          <label className="form-label" htmlFor="rep-week">Minggu yang memuat tanggal</label>
          <input id="rep-week" type="date" name="minggu" defaultValue={day} className="form-input" />
        </div>
        <button className="btn btn-outline">Tampilkan</button>
        <span className="spacer" />
        <span className="muted">{period} · {moved} barang bergerak</span>
        <a className="btn btn-outline" href={'/api/gudang/report?' + new URLSearchParams({ week: day })}><Download aria-hidden /> Unduh Excel</a>
        <button type="button" className="btn btn-primary" onClick={printDocument} disabled={!rows.length}><Printer aria-hidden /> Cetak</button>
      </form>
      <section className="card">
        <div className="table-wrapper"><ReportTable rows={rows} /></div>
      </section>
      <PrintDoc>
        <div className="print-doc-head">
          <div className="print-doc-brand">
            <img src="/brand/prohaba-logo.png" alt="" />
            <div><strong>PT. Prohaba Jaya Mandiri</strong>Gudang HO</div>
          </div>
          <div className="print-doc-title">
            <h1>LIST STOK MATERIAL GUDANG KANTOR</h1>
            <p>{period}</p>
          </div>
        </div>
        <ReportTable rows={rows} />
      </PrintDoc>
    </div>
  );
}
