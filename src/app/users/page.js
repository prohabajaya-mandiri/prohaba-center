import { canAccess } from '@/lib/access';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import UsersClient from './UsersClient';

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/users')) redirect('/dashboard');
  if (!session) redirect('/login');
  if (session.user.role !== 'TOP_MANAGEMENT') redirect('/dashboard');

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true
    }
  });

  return (
    <AppLayout title="Manajemen Pengguna" subtitle="Kelola akun dan hak akses sistem" user={session.user}>
      <UsersClient initialUsers={users} />
    </AppLayout>
  );
}
