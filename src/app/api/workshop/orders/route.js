import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  try {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orders = await prisma.fabricationOrder.findMany({
      include: {
        project: { select: { name: true, code: true } },
        cuttingLists: true,
        deliveries: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}

export async function POST(req) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  try {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const orderCount = await prisma.fabricationOrder.count();
    const orderNumber = `WO-${new Date().getFullYear()}-${String(orderCount + 1).padStart(3, '0')}`;

    const newOrder = await prisma.fabricationOrder.create({
      data: {
        orderNumber,
        projectId: body.projectId,
        description: body.description,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        status: 'PLANNED'
      }
    });

    return NextResponse.json(newOrder, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
