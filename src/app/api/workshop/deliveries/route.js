import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  try {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const ticketCount = await prisma.deliveryTicket.count();
    const ticketNumber = `SJ-${new Date().getFullYear()}-${String(ticketCount + 1).padStart(3, '0')}`;
    
    const newTicket = await prisma.deliveryTicket.create({
      data: {
        ticketNumber,
        fabricationOrderId: body.fabricationOrderId,
        driverName: body.driverName,
        vehicleNumber: body.vehicleNumber,
        deliveryDate: new Date(body.deliveryDate),
        status: 'IN_TRANSIT'
      }
    });

    // Automatically update the work order status to DELIVERED
    await prisma.fabricationOrder.update({
      where: { id: body.fabricationOrderId },
      data: { status: 'DELIVERED' }
    });

    return NextResponse.json(newTicket, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
