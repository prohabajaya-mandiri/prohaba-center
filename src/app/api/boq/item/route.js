import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recalculateSortOrder } from '@/lib/boqUtils';

export async function POST(req) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  try {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { projectId, code, description, totalPrice } = body;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    let weight = null;
    if (totalPrice && project.contractValue) {
      weight = parseFloat(((totalPrice / project.contractValue) * 100).toFixed(4));
    }

    const newItem = await prisma.bOQItem.create({
      data: {
        projectId,
        code: code || '-',
        description: description || 'Item Baru',
        totalPrice: parseFloat(totalPrice) || 0,
        weight,
        level: 2, // Default to level 2 for custom items
      }
    });

    await recalculateSortOrder(projectId);
    return NextResponse.json({ success: true, item: newItem });
  } catch (err) {
    console.error('Create BOQ item error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}