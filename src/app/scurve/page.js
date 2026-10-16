import { canAccess } from '@/lib/access';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import SCurveClient from './SCurveClient';
import { prisma } from '@/lib/prisma';
import { currentTab, tabLabel } from '@/lib/module-tabs';

export const metadata = {
  title: 'S-Curve & Progress',
};

export default async function SCurvePage({ searchParams }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/scurve')) redirect('/dashboard');
  if (!session) redirect('/login');
  const tab = currentTab('/scurve', (await searchParams)?.tab, session.user.role);

  const projects = await prisma.project.findMany({take:1000,
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
      subtitle={tabLabel('/scurve', tab)}
      user={session.user}
    >
      <SCurveClient tab={tab} user={session.user} projects={projects} />
    </AppLayout>
  );
}
