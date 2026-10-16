import ListPager from '@/components/ListPager';
import {pageQuery} from '@/lib/page-query';
import { canAccess } from '@/lib/access';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { prisma } from '@/lib/prisma';
import DocumentsClient from './DocumentsClient';

export const metadata = { title: 'Dokumen Engineering' };

export default async function DocumentsPage({searchParams}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/documents')) redirect('/dashboard');
  if (!session) redirect('/login');
  
  const projects = await prisma.project.findMany({take:1000,
    where: { status: { in: ['ACTIVE', 'ON_HOLD'] } },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' }
  });

  const paging=await pageQuery(searchParams);
  const total=await prisma.document.count();
  const documents = await prisma.document.findMany({
    skip:paging.skip, take:paging.take,
    include: {
      project: { select: { id: true, name: true, code: true } },
      uploader: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <AppLayout title="Dokumen Engineering" subtitle="Manajemen blueprint, spesifikasi, dan laporan" user={session.user}>
      <DocumentsClient initialDocuments={documents} projects={projects} user={session.user} />
    <ListPager page={paging.page} total={total}/></AppLayout>
  );
}
