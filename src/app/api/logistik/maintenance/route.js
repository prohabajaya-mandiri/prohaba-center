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
    const { vehicleId, projectId, type, description, cost, meterValue, mechanic, notes, partName, nextServiceMeter, nextServiceDate } = data;

    if (!vehicleId || !type || !description || cost === undefined) {
      return NextResponse.json({ error: 'Data wajib (Kendaraan, Jenis Servis, Deskripsi, Biaya) harus diisi' }, { status: 400 });
    }

    const maintenanceLog = await prisma.maintenanceLog.create({
      data: {
        vehicleId,
        projectId: projectId || null,
        date: new Date(),
        type,
        description,
        cost: parseFloat(cost),
        meterValue: meterValue ? parseFloat(meterValue) : null,
        mechanic,
        notes,
        partName: partName || null,
        nextServiceMeter: nextServiceMeter ? parseFloat(nextServiceMeter) : null,
        nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
        recordedBy: session.user.id
      }
    });

    return NextResponse.json(maintenanceLog, { status: 201 });
  } catch (error) {
    console.error('Failed to create maintenance log:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
