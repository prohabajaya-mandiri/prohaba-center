import { authorizeApi } from '@/lib/api-access';
import { prisma } from '@/lib/prisma';
import { payrollTransition } from '@/lib/payroll-approval';

export async function POST(request) {
  const { session, error } = await authorizeApi(request);
  if (error) return error;
  const { payrollId, action } = await request.json();
  const transition = payrollTransition(session.user.role, action);
  if (!transition) return Response.json({ error: 'Tindakan tidak diizinkan.' }, { status: 403 });
  try {
    const payroll = await prisma.$transaction(async (tx) => {
      const changed = await tx.payroll.updateMany({
        where: { id: payrollId, status: transition.from }, data: { status: transition.to },
      });
      if (changed.count !== 1) throw new Error('INVALID_STATE');
      await tx.payrollApproval.create({ data: {
        payrollId, approverId: session.user.id, step: transition.step,
        status: action === 'SUBMIT' ? 'SUBMITTED' : 'APPROVED', notes: action,
      } });
      return tx.payroll.findUnique({ where: { id: payrollId } });
    });
    return Response.json(payroll);
  } catch (error) {
    return Response.json({ error: 'Status payroll tidak sesuai atau persetujuan gagal.' }, { status: error.message === 'INVALID_STATE' ? 409 : 500 });
  }
}
