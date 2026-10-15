import { canAccess } from '@/lib/access';
import { prisma } from '@/lib/prisma'
import PayrollClient from './PayrollClient'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'

export const revalidate = 0

export default async function PayrollPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canAccess(session.user.role, '/payroll')) redirect('/dashboard');
  if (!session) redirect('/login');
  const payrolls = await prisma.payroll.findMany({
    include: {
      project: true,
      items: {
        include: {
          employee: true
        }
      },
      approvals: {
        include: {
          approver: { select: { id: true, name: true, role: true } }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  // Format data for client
  const formattedPayrolls = payrolls.map(p => ({
    id: p.id,
    period: p.period,
    projectName: p.project.name,
    totalAmount: p.totalAmount,
    status: p.status,
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),
    employeeCount: p.items.length,
    items: p.items.map(item => ({
      id: item.id,
      employeeName: item.employee.name,
      position: item.employee.position,
      baseSalary: item.baseSalary,
      workDays: item.workDays,
      overtime: item.overtime,
      overtimePay: item.overtimePay,
      allowances: item.allowances,
      deductions: item.deductions,
      bpjsPay: item.bpjsPay,
      netSalary: item.netSalary,
    })),
    approvals: p.approvals.map(app => ({
      id: app.id,
      approverName: app.approver.name,
      role: app.role,
      action: app.action,
      notes: app.notes,
      createdAt: app.createdAt.toISOString()
    }))
  }))

  return (
    <AppLayout title="Payroll" subtitle="Manajemen Gaji & Persetujuan" user={session.user}>
      <PayrollClient payrolls={formattedPayrolls} />
    </AppLayout>
  )
}
