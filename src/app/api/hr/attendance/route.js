import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request) {
  const { session, error: accessError } = await authorizeApi(request);
  if (accessError) return accessError;
  try {
    const data = await request.json()
    const { date, employeeId, status, overtime, notes } = data

    const user = session.user

    const attendance = await prisma.attendance.create({
      data: {
        date: new Date(date),
        employeeId,
        status,
        overtime: parseFloat(overtime) || 0,
        notes,
        enteredBy: user.id
      }
    })

    return NextResponse.json(attendance)
  } catch (error) {
    console.error('Error saving attendance:', error)
    return NextResponse.json({ error: 'Failed to save attendance' }, { status: 500 })
  }
}
