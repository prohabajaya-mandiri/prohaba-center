import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { canAccess } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { STOCK_ADMIN_ROLES } from '@/lib/stock';
import { stockItems, stockLocationDetail } from '@/lib/services/stock';
import AppLayout from '@/components/AppLayout';
import LocationActions from './LocationActions';

export const metadata = { title: 'Rak gudang' };

// Dibuka dari QR label rak/bin/zona: isi lokasi dan, untuk Logistik, tombol ambil / simpan / pindah.
export default async function StockLocationPage({ params }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/gudang')) redirect('/dashboard');
  const data = await stockLocationDetail(decodeURIComponent((await params).code).toUpperCase());
  if (!data) notFound();
  const canEdit = STOCK_ADMIN_ROLES.includes(session.user.role);
  const [items, locations] = canEdit
    ? await Promise.all([
        stockItems(),
        prisma.stockLocation.findMany({ where: { isActive: true }, orderBy: { code: 'asc' }, select: { id: true, code: true } }),
      ])
    : [[], []];

  return (
    <AppLayout title="Gudang HO" subtitle={`Rak ${data.location.code}`} user={session.user}>
      <LocationActions
        location={data.location}
        contents={data.items}
        canEdit={canEdit}
        items={items
          .filter((i) => i.isActive)
          .map((i) => ({ id: i.id, sku: i.sku, name: i.name, unit: i.unit, decimals: i.decimals, avgCost: i.avgCost, homeLocationId: i.homeLocationId, locations: i.locations }))}
        locations={locations}
      />
    </AppLayout>
  );
}
