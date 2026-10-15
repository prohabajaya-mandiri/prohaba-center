import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recalculateSortOrder } from '@/lib/boqUtils';

export async function PUT(req, { params }) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  try {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { code, description, totalPrice } = body;

    const item = await prisma.bOQItem.findUnique({
      where: { id },
      include: { project: true }
    });

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    // Recalculate weight if totalPrice changes
    let weight = item.weight;
    if (totalPrice !== undefined && item.project.contractValue) {
      weight = parseFloat(((totalPrice / item.project.contractValue) * 100).toFixed(4));
    }

    const updated = await prisma.bOQItem.update({
      where: { id },
      data: {
        code: code !== undefined ? code : item.code,
        description: description !== undefined ? description : item.description,
        totalPrice: totalPrice !== undefined ? totalPrice : item.totalPrice,
        weight
      }
    });

    await recalculateSortOrder(item.projectId);
    return NextResponse.json({ success: true, updated });
  } catch (err) {
    console.error('Update BOQ item error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  try {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const item = await prisma.bOQItem.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    await prisma.bOQItem.delete({ where: { id } });

    await recalculateSortOrder(item.projectId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete BOQ item error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
