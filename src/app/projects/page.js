import ListPager from '@/components/ListPager';
import {pageQuery} from '@/lib/page-query';
import { canAccess } from '@/lib/access';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { prisma } from '@/lib/prisma';
import ProjectsClient from './ProjectsClient';

export const metadata = {
  title: 'Proyek',
};

export default async function ProjectsPage({searchParams}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/projects')) redirect('/dashboard');
  if (!session) redirect('/login');

  const paging=await pageQuery(searchParams);
  // Proyek yang diarsipkan tidak ditampilkan lagi di daftar kerja.
  const where = { status: { not: 'ARCHIVED' } };
  const total=await prisma.project.count({ where });
  const projects = await prisma.project.findMany({
    where, skip:paging.skip, take:paging.take,
    orderBy: { createdAt: 'desc' }
  });

  return (
    <AppLayout 
      title="Manajemen Proyek" 
      subtitle={`${total} proyek tercatat`}
      user={session.user}
    >
      <ProjectsClient initialProjects={projects} user={session.user} />
    <ListPager page={paging.page} total={total}/></AppLayout>
  );
}
