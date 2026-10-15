import { canAccess } from '@/lib/access';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import SCurveClient from './SCurveClient';
import { prisma } from '@/lib/prisma';

export const metadata = {
  title: 'S-Curve & Progress — ERP Prohaba Jaya Mandiri',
};

export default async function SCurvePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/scurve')) redirect('/dashboard');
  if (!session) redirect('/login');

  const projects = await prisma.project.findMany({
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      client: true,
      contractValue: true,
      startDate: true,
      endDate: true,
      status: true,
    }
  });

  return (
    <AppLayout
      title="S-Curve & Progress"
      subtitle="Monitoring rencana vs realisasi berbasis BOQ"
      user={session.user}
    >
      <SCurveClient user={session.user} projects={projects} />
    </AppLayout>
  );
}
