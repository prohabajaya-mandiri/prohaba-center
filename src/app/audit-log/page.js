import { canAccess } from '@/lib/access';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import AuditLogClient from './AuditLogClient';

export const metadata = { title: 'Audit Log' };

export const revalidate = 0;

export default async function AuditLogPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/audit-log')) redirect('/dashboard');
  if (!session) redirect('/login');
  
  // Hanya TOP_MANAGEMENT yang boleh akses
  if (session.user.role !== 'TOP_MANAGEMENT') {
    redirect('/dashboard');
  }

  return (
    <AppLayout title="Audit Log" subtitle="Sistem Pelacakan Keamanan & Riwayat Aktivitas" user={session.user}>
      <AuditLogClient />
    </AppLayout>
  );
}
