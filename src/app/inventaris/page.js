import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { canAccess } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { pageQuery } from '@/lib/page-query';
import { assetSummary, assetWhere, listBatches } from '@/lib/services/assets';
import { PRICE_ROLES } from '@/lib/assets';
import { currentTab, tabLabel } from '@/lib/module-tabs';
import AppLayout from '@/components/AppLayout';
import ListPager from '@/components/ListPager';
import AssetList from './AssetList';
import RegisterImport from './RegisterImport';

export const metadata = {
  title: 'Inventaris Aset',
};

export default async function InventarisPage({ searchParams }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/inventaris')) redirect('/dashboard');
  const { role } = session.user;
  const query = (await searchParams) ?? {};
  const tab = currentTab('/inventaris', query.tab, role);

  if (tab === 'import') {
    return (
      <AppLayout title="Inventaris Aset" subtitle={tabLabel('/inventaris', tab)} user={session.user}>
        <RegisterImport />
      </AppLayout>
    );
  }

  const filters = {
    q: typeof query.q === 'string' ? query.q : '',
    kategori: typeof query.kategori === 'string' ? query.kategori : '',
    lokasi: typeof query.lokasi === 'string' ? query.lokasi : '',
    kondisi: typeof query.kondisi === 'string' ? query.kondisi : '',
  };
  const paging = await pageQuery(searchParams);
  const [summary, batches, locations] = await Promise.all([
    assetSummary(role),
    listBatches(assetWhere(filters), paging, role),
    prisma.assetLocation.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));

  return (
    <AppLayout title="Inventaris Aset" subtitle={tabLabel('/inventaris', tab)} user={session.user}>
      <AssetList
        summary={summary}
        rows={batches.rows}
        locations={locations}
        filters={filters}
        showPrice={PRICE_ROLES.includes(role)}
      />
      <ListPager page={paging.page} total={batches.total} query={{ tab, ...active }} />
    </AppLayout>
  );
}
