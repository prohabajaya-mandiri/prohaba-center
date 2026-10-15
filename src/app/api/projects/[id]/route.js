import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(req, { params }) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  try {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (session.user.role !== 'TOP_MANAGEMENT') {
      return NextResponse.json({ error: 'Forbidden: Hak akses ditolak. Hanya TOP_MANAGEMENT yang dapat menghapus proyek.' }, { status: 403 });
    }

    const { id } = await params;
    
    // Project dan semua relasinya akan dihapus otomatis karena onDelete: Cascade di schema
    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE project error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  try {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const newContractValue = body.contractValue ? parseFloat(body.contractValue) : null;
    const oldProject = await prisma.project.findUnique({ where: { id } });

    const updated = await prisma.project.update({
      where: { id },
      data: {
        code: body.code,
        name: body.name,
        client: body.client,
        location: body.location,
        contractValue: newContractValue,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        status: body.status,
      }
    });

    // If contract value changed, recalculate all BOQ item weights
    if (newContractValue && oldProject.contractValue !== newContractValue) {
      const boqItems = await prisma.bOQItem.findMany({ where: { projectId: id } });
      if (boqItems.length > 0) {
        for (const item of boqItems) {
          if (item.totalPrice != null) {
            const newWeight = parseFloat(((item.totalPrice / newContractValue) * 100).toFixed(4));
            await prisma.bOQItem.update({
              where: { id: item.id },
              data: { weight: newWeight }
            });
          }
        }
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH project error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
