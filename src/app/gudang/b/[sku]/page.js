import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { canAccess } from '@/lib/access';
import { stockItemDetail } from '@/lib/services/stock';
import { DOC_TYPES, fmtQty } from '@/lib/stock';
import { fmtDate, idr } from '@/lib/ui-labels';
import AppLayout from '@/components/AppLayout';

export const metadata = { title: 'Kartu stok' };

// Dibuka dari QR label barang: stok per lokasi dan kartu stok.
export default async function StockItemPage({ params }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/gudang')) redirect('/dashboard');
  const data = await stockItemDetail(decodeURIComponent((await params).sku));
  if (!data) notFound();
  const { item, locations, movements } = data;
  const total = locations.reduce((s, l) => s + l.qty, 0);

  return (
    <AppLayout title="Gudang HO" subtitle={`Kartu stok ${item.sku}`} user={session.user}>
      <div className="stack">
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{item.name}</div>
              <div className="card-subtitle">{[item.sku, item.group.name, item.spec].filter(Boolean).join(' · ')}{item.isActive ? '' : ' · nonaktif'}</div>
            </div>
            <Link className="btn btn-outline" href="/gudang?tab=stok">Semua barang</Link>
          </div>
          <div className="card-body form-grid">
            <div><div className="form-label">Stok</div><div style={{ fontSize: 22, fontWeight: 600 }}>{fmtQty(total)} {item.unit}</div></div>
            <div><div className="form-label">Harga rata-rata</div><div style={{ fontSize: 22, fontWeight: 600 }}>{idr(item.avgCost)}</div></div>
            <div><div className="form-label">Lokasi utama</div>{item.homeLocation ? <Link href={'/gudang/l/' + item.homeLocation.code}>{item.homeLocation.code}</Link> : '-'}</div>
            <div>
              <div className="form-label">Stok per lokasi</div>
              {locations.length ? locations.map((l) => <div key={l.code}><Link href={'/gudang/l/' + l.code}>{l.code}</Link>: {fmtQty(l.qty)}</div>) : '-'}
            </div>
            {item.notes && <div><div className="form-label">Catatan dari opname</div>{item.notes}</div>}
          </div>
        </section>
        <section className="card">
          <div className="card-header"><div className="card-title">Kartu stok</div></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Tanggal</th><th>Dokumen</th><th>Tujuan / asal</th><th>Lokasi</th><th className="num">Jumlah</th><th className="num">Harga</th></tr></thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} style={m.document.status === 'DIBATALKAN' ? { opacity: 0.5, textDecoration: 'line-through' } : undefined}>
                    <td className="nowrap">{fmtDate(m.document.docDate)}</td>
                    <td className="nowrap">{m.document.number}<div className="cell-sub">{DOC_TYPES[m.document.type]?.label}</div></td>
                    <td>{m.document.project ? `${m.document.project.code} — ${m.document.project.name}` : m.document.destination ?? '-'}</td>
                    <td>{m.location.code}</td>
                    <td className="num nowrap" style={{ color: Number(m.qty) < 0 ? 'var(--red-600)' : 'var(--green-700)' }}>{Number(m.qty) > 0 ? '+' : ''}{fmtQty(m.qty)}</td>
                    <td className="num nowrap">{idr(m.unitCost)}</td>
                  </tr>
                ))}
                {!movements.length && <tr><td colSpan={6} className="cell-empty">Belum ada pergerakan</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
