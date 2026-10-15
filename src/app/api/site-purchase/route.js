import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request) {
  const { session, error: accessError } = await authorizeApi(request);
  if (accessError) return accessError;
  try {
    const data = await request.json()
    const { projectId, purchaseDate, description, vendor, unit, quantity, unitPrice, refPrice, notes } = data
    const userId = session.user.id
    
    if (!projectId || !description || !vendor || !unit || quantity === undefined || unitPrice === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const q = parseFloat(quantity)
    const price = parseFloat(unitPrice)
    const ref = refPrice ? parseFloat(refPrice) : null
    const totalAmount = q * price

    let priceFlag = false
    let flagPct = null

    if (ref && ref > 0) {
      const diff = price - ref
      const pct = (diff / ref) * 100
      if (pct > 10) {
        priceFlag = true
        flagPct = pct
      }
    } else {
      // If no reference price found, it defaults to true (flagged for manual review)
      priceFlag = true
    }

    const sitePurchase = await prisma.sitePurchase.create({
      data: {
        projectId,
        purchaseDate: new Date(purchaseDate),
        description,
        vendor,
        unit,
        quantity: q,
        unitPrice: price,
        totalAmount,
        refPrice: ref,
        priceFlag,
        flagPct: flagPct !== null ? parseFloat(flagPct.toFixed(2)) : null,
        status: 'PENDING',
        notes
      }
    })

    if (priceFlag) {
      await prisma.purchaseFlag.create({
        data: {
          sitePurchaseId: sitePurchase.id,
          flaggedBy: userId,
          reason: ref ? `Mark-up terdeteksi: +${flagPct.toFixed(2)}% di atas referensi pasar` : `Tidak ada harga referensi. Review manual dibutuhkan.`
        }
      })
    }

    return NextResponse.json(sitePurchase)
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}
