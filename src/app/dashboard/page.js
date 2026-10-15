import { canAccess } from '@/lib/access';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import DashboardClient from './DashboardClient';

export const metadata = {
  title: 'Dashboard — ERP Prohaba Jaya Mandiri',
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/dashboard')) redirect('/dashboard');
  if (!session) redirect('/login');

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Overview semua proyek & KPI perusahaan"
      user={session.user}
    >
      <DashboardClient user={session.user} />
    </AppLayout>
  );
}
