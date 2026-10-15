import { canAccess } from '@/lib/access';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { prisma } from '@/lib/prisma';
import RevenueClient from './RevenueClient';


export default async function RevenuePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/revenue')) redirect('/dashboard');
  if (!session) redirect('/login');
  
  // Ambil data project dan invoices
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, client: true },
    orderBy: { createdAt: 'desc' }
  });
  
  const invoices = await prisma.salesInvoice.findMany({
    include: {
      project: true,
      journalVoucher: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <AppLayout title="Pendapatan" subtitle="Kelola Penagihan" user={session.user}>
      <RevenueClient invoices={invoices} projects={projects} />
    </AppLayout>
  );
}
