import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { canAccess } from '@/lib/access';
import { stockLocationDetail } from '@/lib/services/stock';
import { LOCATION_TYPES, fmtQty } from '@/lib/stock';
import AppLayout from '@/components/AppLayout';

export const metadata = { title: 'Isi lokasi gudang' };

// Dibuka dari QR label rak/bin/zona: barang yang ada di lokasi ini.
export default async function StockLocationPage({ params }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/gudang')) redirect('/dashboard');
  const data = await stockLocationDetail(decodeURIComponent((await params).code));
  if (!data) notFound();
  const { location, items } = data;

  return (
    <AppLayout title="Gudang HO" subtitle={`Lokasi ${location.code}`} user={session.user}>
      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">{location.code}</div>
            <div className="card-subtitle">
              {[LOCATION_TYPES[location.type], location.description].filter(Boolean).join(' · ')}
              {location.parent && <> · di <Link href={'/gudang/l/' + location.parent.code}>{location.parent.code}</Link></>}
            </div>
          </div>
          <Link className="btn btn-outline" href="/gudang?tab=lokasi">Semua lokasi</Link>
        </div>
        {location.children.length > 0 && (
          <div className="card-body">Bin: {location.children.map((c, i) => <span key={c.id}>{i ? ', ' : ''}<Link href={'/gudang/l/' + c.code}>{c.code}</Link></span>)}</div>
        )}
        <div className="table-wrapper">
          <table>
            <thead><tr><th>SKU</th><th>Barang</th><th className="num">Jumlah</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="nowrap"><Link href={'/gudang/b/' + i.sku}>{i.sku}</Link></td>
                  <td>{i.name}{i.spec && <div className="cell-sub">{i.spec}</div>}</td>
                  <td className="num nowrap">{fmtQty(i.qty)} {i.unit}</td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={3} className="cell-empty">Lokasi ini kosong</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </AppLayout>
  );
}
