import ListPager from '@/components/ListPager';
import {pageQuery} from '@/lib/page-query';
import { canAccess } from '@/lib/access';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { prisma } from '@/lib/prisma';
import WorkshopClient from './WorkshopClient';
import { currentTab, tabLabel } from '@/lib/module-tabs';

export const metadata = { title: 'Workshop & Fabrikasi' };

export default async function WorkshopPage({searchParams}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/workshop')) redirect('/dashboard');
  if (!session) redirect('/login');
  
  const projects = await prisma.project.findMany({take:1000,
    select: { id: true, name: true, code: true },
    orderBy: { createdAt: 'desc' }
  });
  
  const paging=await pageQuery(searchParams);
  const tab=currentTab('/workshop',(await searchParams)?.tab,session.user.role);
  const total=await prisma.fabricationOrder.count();
  const orders = await prisma.fabricationOrder.findMany({
    skip:paging.skip, take:paging.take,
    include: {
      project: { select: { id: true, name: true, code: true } },
      cuttingLists: true,
      deliveries: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <AppLayout title="Workshop & Fabrikasi" subtitle={tabLabel('/workshop',tab)} user={session.user}>
      <WorkshopClient tab={tab} initialOrders={orders} projects={projects} />
    <ListPager page={paging.page} total={total} query={{tab}}/></AppLayout>
  );
}
