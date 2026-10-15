import { canAccess } from '@/lib/access';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import AppLayout from '@/components/AppLayout';
import SitePurchaseClient from './SitePurchaseClient';

export default async function SitePurchasePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/site-purchase')) redirect('/dashboard');
  if (!session) redirect('/login');

  const sitePurchases = await prisma.sitePurchase.findMany({
    include: {
      flags: {
        include: { flagger: true }
      }
    },
    orderBy: { purchaseDate: 'desc' }
  });

  const projects = await prisma.project.findMany({
    orderBy: { code: 'asc' }
  });

  const priceReferences = await prisma.priceReference.findMany();

  // Kita tidak me-load project lengkap ke Client, hanya dictionary nama biar gampang map
  const projectDict = {};
  projects.forEach(p => {
    projectDict[p.id] = p.code;
  });

  return (
    <AppLayout title="Site Purchase & Anti-Markup" subtitle="Pemantauan pembelian langsung dari lapangan" user={session.user}>
      <SitePurchaseClient sitePurchases={sitePurchases} projects={projects} projectDict={projectDict} priceReferences={priceReferences} user={session.user} />
    </AppLayout>
  );
}
