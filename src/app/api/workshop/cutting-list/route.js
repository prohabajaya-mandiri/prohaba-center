import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  try {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    
    const newItem = await prisma.cuttingList.create({
      data: {
        fabricationOrderId: body.fabricationOrderId,
        materialName: body.materialName,
        dimensions: body.dimensions,
        quantity: parseInt(body.quantity) || 1,
        status: 'PENDING'
      }
    });

    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
