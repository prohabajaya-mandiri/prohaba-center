import { ROLES } from '@/lib/access';
import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function PUT(req, { params }) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  try {
    if (!session || session.user.role !== 'TOP_MANAGEMENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, email, role, isActive, password } = body;
    if (!ROLES.includes(role) || (password !== undefined && password !== "" && (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password) > 72))) {
      return NextResponse.json({ error: "Role tidak valid atau password harus 12–72 byte." }, { status: 400 });
    }

    const data = { name, email, role, isActive };
    
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    // Get old data for audit log
    const oldData = await prisma.user.findUnique({ where: { id } });

    const user = await prisma.user.update({
      where: { id },
      data
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        module: 'USER_MANAGEMENT',
        recordId: user.id,
        oldValue: JSON.stringify({ role: oldData.role, isActive: oldData.isActive }),
        newValue: JSON.stringify({ role: user.role, isActive: user.isActive }),
      }
    });

    return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
