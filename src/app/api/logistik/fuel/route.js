import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  try {
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const { vehicleId, projectId, fuelType, liters, totalCost, meterValue, operator } = data;

    if (!vehicleId || !fuelType || !liters || !totalCost) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const fuelLog = await prisma.fuelLog.create({
      data: {
        vehicleId,
        projectId,
        date: new Date(),
        fuelType,
        liters,
        totalCost,
        meterValue,
        operator,
        recordedBy: session.user.id
      }
    });

    return NextResponse.json(fuelLog, { status: 201 });
  } catch (error) {
    console.error('Failed to save fuel log:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
