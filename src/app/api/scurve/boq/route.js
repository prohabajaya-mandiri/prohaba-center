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

    const boqItems = await prisma.bOQItem.findMany({
      where: { projectId },
      orderBy: { code: 'asc' }
    })
    
    return NextResponse.json(boqItems)
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}

export async function POST(request) {
  const { session, error: accessError } = await authorizeApi(request);
  if (accessError) return accessError;
  try {
    const data = await request.json()
    const { projectId, items } = data
    
    if (!projectId || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    
    // Calculate weights assuming sum of (quantity * unitPrice) is total
    const totalAmount = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0)
    
    const boqData = items.map(item => {
      const amount = item.quantity * item.unitPrice;
      const weight = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
      return {
        projectId,
        code: item.code,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        weight: weight
      }
    })

    // Delete existing to replace
    await prisma.bOQItem.deleteMany({ where: { projectId } })
    
    const created = await prisma.bOQItem.createMany({
      data: boqData
    })

    return NextResponse.json({ message: 'BOQ updated', count: created.count })
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}
