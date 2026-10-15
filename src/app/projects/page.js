import { canAccess } from '@/lib/access';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { prisma } from '@/lib/prisma';
import ProjectsClient from './ProjectsClient';

export const metadata = {
  title: 'Manajemen Proyek — ERP Prohaba Jaya Mandiri',
};

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/projects')) redirect('/dashboard');
  if (!session) redirect('/login');

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <AppLayout 
      title="Manajemen Proyek" 
      subtitle={`${projects.length} proyek aktif`} 
      user={session.user}
    >
      <ProjectsClient initialProjects={projects} user={session.user} />
    </AppLayout>
  );
}
