import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



// GET /api/boq/actual?projectId=xxx&month=2025-01
export async function GET(req) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const month = searchParams.get('month');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const where = { projectId };
  if (month) where.month = month;

  const actuals = await prisma.boqActual.findMany({ where, orderBy: { month: 'asc' } });
  return NextResponse.json(actuals);
}

// POST /api/boq/actual — upsert realisasi bulan
export async function POST(req) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { boqItemId, projectId, month, volumeActual, costActual, progressPct, notes } = await req.json();

  const existing = await prisma.boqActual.findFirst({ where: { boqItemId, month } });

  let result;
  if (existing) {
    result = await prisma.boqActual.update({
      where: { id: existing.id },
      data: { volumeActual, costActual, progressPct, notes },
    });
  } else {
    result = await prisma.boqActual.create({
      data: { boqItemId, projectId, month, volumeActual, costActual, progressPct, notes, inputBy: session.user.id },
    });
  }

  return NextResponse.json(result);
}
