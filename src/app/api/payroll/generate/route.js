import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request) {
  const { session, error: accessError } = await authorizeApi(request);
  if (accessError) return accessError;
  try {
    const data = await request.json()
    const { projectId, period } = data // period: YYYY-MM

    const adminUser = session.user

    // Determine start and end date for the period
    const [year, month] = period.split('-')
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0) // Last day of the month

    // Find all employees assigned to the project
    const projectEmployees = await prisma.employeeProject.findMany({
      where: { projectId },
      include: { employee: true }
    })

    if (projectEmployees.length === 0) {
      return NextResponse.json({ error: 'Tidak ada pegawai di proyek ini.' }, { status: 400 })
    }

    // Get attendances for these employees in the given period
    const employeeIds = projectEmployees.map(pe => pe.employeeId)
    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: {
          gte: startDate,
          lte: endDate
        },
        status: 'HADIR'
      }
    })

    // Group attendances by employee
    const attendanceStats = {}
    employeeIds.forEach(id => {
      attendanceStats[id] = { workDays: 0, overtime: 0 }
    })

    attendances.forEach(att => {
      attendanceStats[att.employeeId].workDays += 1
      attendanceStats[att.employeeId].overtime += (att.overtime || 0)
    })

    // Calculate payroll for each employee
    let totalPayrollAmount = 0
    const payrollItemsData = []

    for (const pe of projectEmployees) {
      const emp = pe.employee
      const stats = attendanceStats[emp.id]
      
      const baseSalary = emp.dailyRate * stats.workDays
      const overtimePay = emp.overtimeRate * stats.overtime
      const allowances = 0 // Can be fetched from a formula
      const deductions = 0
      const netSalary = baseSalary + overtimePay + allowances - deductions

      totalPayrollAmount += netSalary

      payrollItemsData.push({
        employeeId: emp.id,
        workDays: stats.workDays,
        overtime: stats.overtime,
        baseSalary,
        overtimePay,
        allowances,
        deductions,
        netSalary
      })
    }

    // Create Payroll and PayrollItems
    const payroll = await prisma.payroll.create({
      data: {
        period,
        projectId,
        totalAmount: totalPayrollAmount,
        status: 'DRAFT',
        createdBy: adminUser.id,
        items: {
          create: payrollItemsData
        }
      },
      include: {
        items: true
      }
    })

    return NextResponse.json(payroll)
  } catch (error) {
    console.error('Error generating payroll:', error)
    return NextResponse.json({ error: 'Failed to generate payroll' }, { status: 500 })
  }
}
