import ListPager from '@/components/ListPager';
import {pageQuery} from '@/lib/page-query';
import { canAccess } from '@/lib/access';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import AppLayout from '@/components/AppLayout';
import MaterialRequestClient from './MaterialRequestClient';

export default async function MaterialRequestPage({searchParams}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/material-request')) redirect('/dashboard');
  if (!session) redirect('/login');

  const paging=await pageQuery(searchParams);
  const total=await prisma.materialRequest.count();
  const requests = await prisma.materialRequest.findMany({
    skip:paging.skip, take:paging.take,
    include: {
      project: true,
      requester: { select: { id: true, name: true, role: true } },
      items: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  const projects = await prisma.project.findMany({take:1000,
    orderBy: { code: 'asc' }
  });

  return (
    <AppLayout title="Material Request" subtitle="Permintaan material & alat dari Site ke Pusat" user={session.user}>
      <MaterialRequestClient requests={requests} projects={projects} user={session.user} />
    <ListPager page={paging.page} total={total}/></AppLayout>
  );
}