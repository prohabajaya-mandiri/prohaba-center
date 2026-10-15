import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const { session, error: accessError } = await authorizeApi(request);
  if (accessError) return accessError;
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
    }

    const baselines = await prisma.sCurveBaseline.findMany({
      where: { projectId },
      orderBy: { week: 'asc' }
    })
    
    return NextResponse.json(baselines)
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}

export async function POST(request) {
  const { session, error: accessError } = await authorizeApi(request);
  if (accessError) return accessError;
  try {
    const data = await request.json()
    const { projectId, baselines } = data
    
    if (!projectId || !baselines || !Array.isArray(baselines)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const baselineData = baselines.map(b => ({
      projectId,
      week: b.week,
      planned: b.planned,
      date: new Date(b.date)
    }))

    await prisma.sCurveBaseline.deleteMany({ where: { projectId } })
    
    const created = await prisma.sCurveBaseline.createMany({
      data: baselineData
    })

    return NextResponse.json({ message: 'Baselines updated', count: created.count })
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}
