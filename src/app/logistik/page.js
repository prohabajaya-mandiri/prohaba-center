import {pageQuery} from '@/lib/page-query';
import ListPager from '@/components/ListPager';
import { redirect } from 'next/navigation';
import { canAccess } from '@/lib/access';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import LogistikClient from './LogistikClient';
import AppLayout from '@/components/AppLayout';
import { currentTab, tabLabel } from '@/lib/module-tabs';

export const metadata = {
  title: 'Logistik & Kendaraan',
};

export default async function LogistikPage({searchParams}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/logistik')) redirect('/dashboard');
  
  const paging=await pageQuery(searchParams);
  const tab=currentTab('/logistik',(await searchParams)?.tab,session.user.role);
  const [fuelCount,maintenanceCount]=await Promise.all([prisma.fuelLog.count(),prisma.maintenanceLog.count()]);
  const vehicles = await prisma.vehicle.findMany({take:1000,
    orderBy: { createdAt: 'desc' }
  });

  const fuelLogs = await prisma.fuelLog.findMany({skip:paging.skip,take:paging.take,
    include: {
      vehicle: true,
      project: true,
      user: { select: { id: true, name: true, role: true } },
    },
    orderBy: { date: 'desc' }
  });

  const maintenanceLogs = await prisma.maintenanceLog.findMany({skip:paging.skip,take:paging.take,
    include: {
      vehicle: true,
      project: true,
      user: { select: { id: true, name: true, role: true } },
    },
    orderBy: { date: 'desc' }
  });

  const projects = await prisma.project.findMany({take:1000,
    select: { id: true, name: true, code: true }
  });

  return (
    <AppLayout title="Logistik & Kendaraan" subtitle={tabLabel('/logistik',tab)} user={session?.user}>
      <LogistikClient
        tab={tab}
        user={session?.user} 
        vehicles={vehicles} 
        fuelLogs={fuelLogs} 
        maintenanceLogs={maintenanceLogs}
        projects={projects}
      />
    {['fuel','maintenance'].includes(tab)&&<ListPager page={paging.page} total={tab==='fuel'?fuelCount:maintenanceCount} query={{tab}}/>}</AppLayout>
  );
}
