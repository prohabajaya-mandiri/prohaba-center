import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { auth } from '@/auth';
import { canAccess } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { LOCATION_TYPES } from '@/lib/stock';
import AppLayout from '@/components/AppLayout';
import LabelSheet from './LabelSheet';

export const metadata = { title: 'Label QR gudang' };

const list = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 500) : []);

// Label 50 × 30 mm: QR berisi URL halaman barang/lokasi, jadi kamera HP biasa langsung membukanya.
export default async function LabelPage({ searchParams }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/gudang')) redirect('/dashboard');
  const query = (await searchParams) ?? {};
  const h = await headers();
  const origin = process.env.AUTH_URL?.replace(/\/$/, '') ?? `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;

  const [items, locations] = await Promise.all([
    prisma.stockItem.findMany({ where: { sku: { in: list(query.barang) } }, orderBy: { sku: 'asc' }, select: { sku: true, name: true, spec: true, unit: true } }),
    prisma.stockLocation.findMany({ where: { code: { in: list(query.lokasi) } }, orderBy: { code: 'asc' }, select: { code: true, type: true, description: true } }),
  ]);
  const svg = (url) => QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  const labels = [
    ...(await Promise.all(locations.map(async (l) => ({
      key: 'l' + l.code, code: l.code, line: [LOCATION_TYPES[l.type], l.description].filter(Boolean).join(' · '), qr: await svg(`${origin}/gudang/l/${l.code}`),
    })))),
    ...(await Promise.all(items.map(async (i) => ({
      key: 'b' + i.sku, code: i.sku, line: [i.name, i.spec].filter(Boolean).join(' · '), qr: await svg(`${origin}/gudang/b/${i.sku}`),
    })))),
  ];

  return (
    <AppLayout title="Gudang HO" subtitle="Label QR" user={session.user}>
      <LabelSheet labels={labels} />
    </AppLayout>
  );
}
