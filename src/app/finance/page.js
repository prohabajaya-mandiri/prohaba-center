import { canAccess } from '@/lib/access';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import FinanceClient from './FinanceClient';
import { prisma } from '@/lib/prisma';

export const metadata = { title: 'Keuangan & Akuntansi (Accurate Mode) — ERP Prohaba Jaya Mandiri' };

export default async function FinancePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/finance')) redirect('/dashboard');
  if (!session) redirect('/login');

  const glAccounts = await prisma.gLAccount.findMany({
    orderBy: { accountNo: 'asc' }
  });

  const purchaseInvoices = await prisma.purchaseInvoice.findMany({
    include: { vendor: true, project: true },
    orderBy: { dueDate: 'asc' }
  });

  const salesInvoices = await prisma.salesInvoice.findMany({
    include: { project: true },
    orderBy: { date: 'asc' }
  });

  // Calculate project profitability based on salesInvoices & purchaseInvoices + generic expenses
  const projects = await prisma.project.findMany();
  const profitData = projects.map(p => {
    const revenue = salesInvoices.filter(s => s.projectId === p.id).reduce((sum, s) => sum + s.amount, 0) || (p.contractValue / 4); // Dummy if no revenue
    const cost = purchaseInvoices.filter(i => i.projectId === p.id).reduce((sum, i) => sum + i.totalAmount, 0) || (p.contractValue / 6); // Dummy if no cost
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return {
      project: p.code,
      name: p.name,
      kontrak: revenue / 1e6, // In Millions
      biaya: cost / 1e6,
      profit: profit / 1e6,
      margin: Number(margin.toFixed(1))
    };
  });

  return (
    <AppLayout title="Keuangan & Akuntansi (Accurate Standard)" subtitle="Buku Besar, Faktur Pembelian (AP), Faktur Penjualan (AR) & Profitabilitas Proyek" user={session.user}>
      <FinanceClient 
        user={session.user} 
        glAccounts={glAccounts} 
        purchaseInvoices={purchaseInvoices}
        profitData={profitData}
      />
    </AppLayout>
  );
}
