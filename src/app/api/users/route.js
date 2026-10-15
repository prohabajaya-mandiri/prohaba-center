import { ROLES } from '@/lib/access';
import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  try {
    if (!session || session.user.role !== 'TOP_MANAGEMENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, password, role } = body;
    if (!ROLES.includes(role) || (password !== undefined && password !== "" && (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password) > 72))) {
      return NextResponse.json({ error: "Role tidak valid atau password harus 12–72 byte." }, { status: 400 });
    }

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Check existing
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        isActive: true,
      }
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        module: 'USER_MANAGEMENT',
        recordId: user.id,
        newValue: JSON.stringify({ name: user.name, email: user.email, role: user.role }),
      }
    });

    return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
