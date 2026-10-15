import { canAccess } from '@/lib/access';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import AppLayout from '@/components/AppLayout';
import ProcurementClient from './ProcurementClient';

export default async function ProcurementPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/procurement')) redirect('/dashboard');
  if (!session) redirect('/login');

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    include: {
      project: true,
      vendor: true,
      mr: true,
      items: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  const materialRequests = await prisma.materialRequest.findMany({
    where: { status: 'APPROVED' },
    include: { project: true, items: true, requester: { select: { id: true, name: true, role: true } } }
  });

  const vendors = await prisma.vendor.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' }
  });

  return (
    <AppLayout title="Procurement & PO" subtitle="Pembuatan dan pemantauan Purchase Order" user={session.user}>
      <ProcurementClient purchaseOrders={purchaseOrders} materialRequests={materialRequests} vendors={vendors} user={session.user} />
    </AppLayout>
  );
}
