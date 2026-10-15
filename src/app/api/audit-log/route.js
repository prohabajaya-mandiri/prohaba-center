import {pagination,text} from '@/lib/validation';
import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  const { session, error: accessError } = await authorizeApi(request);
  if (accessError) return accessError;
  try {
    if (!session || session.user.role !== 'TOP_MANAGEMENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const moduleFilter = searchParams.get('module');
    const actionFilter = searchParams.get('action');
    const search = searchParams.get('search'); // Used for User Name
    
    // Pagination
    const {page,limit,skip}=pagination(searchParams);

    const where = {};
    if (moduleFilter) where.module = moduleFilter;
    if (actionFilter) where.action = actionFilter;
    if (search) { text(search,'Pencarian',200);
      where.user = {
        name: { contains: search, mode: 'insensitive' }
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { name: true, role: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where })
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('AuditLog GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: error.status??500 });
  }
}
