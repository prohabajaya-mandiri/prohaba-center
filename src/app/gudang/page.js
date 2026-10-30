import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { canAccess } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { pageQuery } from '@/lib/page-query';
import { STOCK_ADMIN_ROLES } from '@/lib/stock';
import { stockDocument, stockDocuments, stockItems, stockLocations, weeklyStock } from '@/lib/services/stock';
import { currentTab, tabLabel } from '@/lib/module-tabs';
import { businessToday } from '@/lib/client-api';
import AppLayout from '@/components/AppLayout';
import ListPager from '@/components/ListPager';
import StockList from './StockList';
import DocumentList from './DocumentList';
import WeeklyReport from './WeeklyReport';
import LocationList from './LocationList';
import OpnameImport from './OpnameImport';
import ScanStation from './ScanStation';

export const metadata = {
  title: 'Gudang HO',
};

export default async function GudangPage({ searchParams }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/gudang')) redirect('/dashboard');
  const query = (await searchParams) ?? {};
  const tab = currentTab('/gudang', query.tab, session.user.role);
  const canEdit = STOCK_ADMIN_ROLES.includes(session.user.role);
  const layout = (children) => (
    <AppLayout title="Gudang HO" subtitle={tabLabel('/gudang', tab)} user={session.user}>{children}</AppLayout>
  );

  if (tab === 'import') return layout(<OpnameImport />);

  if (tab === 'scan') {
    const projects = await prisma.project.findMany({ where: { status: 'ACTIVE' }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } });
    return layout(<ScanStation projects={projects} canEdit={canEdit} />);
  }

  if (tab === 'lokasi') return layout(<LocationList locations={await stockLocations()} canEdit={canEdit} />);

  if (tab === 'laporan') {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(query.minggu ?? '') ? query.minggu : businessToday();
    const report = await weeklyStock(day);
    return layout(<WeeklyReport day={day} start={report.start} end={report.end} rows={report.rows} />);
  }

  const [items, locations, projects] = await Promise.all([
    stockItems(),
    prisma.stockLocation.findMany({ where: { isActive: true }, orderBy: { code: 'asc' }, select: { id: true, code: true } }),
    prisma.project.findMany({ where: { status: 'ACTIVE' }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
  ]);
  const forms = { items, locations, projects, canEdit, isTop: session.user.role === 'TOP_MANAGEMENT' };

  if (tab === 'transaksi') {
    const paging = await pageQuery(searchParams);
    const filters = { type: typeof query.jenis === 'string' ? query.jenis : '', projectId: typeof query.proyek === 'string' ? query.proyek : '' };
    const docs = await stockDocuments(paging, filters);
    const active = Object.fromEntries(Object.entries({ jenis: filters.type, proyek: filters.projectId }).filter(([, v]) => v));
    return layout(
      <>
        <DocumentList rows={docs.rows} filters={filters} opened={typeof query.doc === 'string' ? await stockDocument(query.doc).catch(() => null) : null} {...forms} />
        <ListPager page={paging.page} total={docs.total} query={{ tab, ...active }} />
      </>,
    );
  }

  return layout(<StockList {...forms} />);
}

