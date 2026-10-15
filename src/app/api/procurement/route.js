import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request) {
  const { session, error: accessError } = await authorizeApi(request);
  if (accessError) return accessError;
  try {
    const data = await request.json()
    const { mrId, projectId, vendorId, items, deliveryNotes, issuedBy } = data
    
    if (!mrId || !projectId || !vendorId || !items || items.length === 0 || !issuedBy) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)

    // Generate PO Number
    const count = await prisma.purchaseOrder.count()
    const poNumber = `PO-${new Date().getFullYear()}-${(count + 1).toString().padStart(3, '0')}`

    // Create PO and update MR status
    const result = await prisma.$transaction(async (prisma) => {
      const purchaseOrder = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          projectId,
          mrId,
          vendorId,
          issuedBy,
          totalAmount,
          status: 'CREATED',
          deliveryNotes,
          items: {
            create: items.map(item => ({
              description: item.description,
              unit: item.unit,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice),
              totalPrice: parseFloat(item.quantity) * parseFloat(item.unitPrice)
            }))
          }
        },
        include: {
          items: true
        }
      })

      // Update MR Status
      await prisma.materialRequest.update({
        where: { id: mrId },
        data: { status: 'PO_CREATED' }
      })

      return purchaseOrder
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}
