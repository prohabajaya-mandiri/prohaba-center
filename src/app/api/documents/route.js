import { authorizeApi } from '@/lib/api-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'node:crypto';

export async function GET(req) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  try {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const documents = await prisma.document.findMany({
      include: {
        project: { select: { id: true, name: true, code: true } },
        uploader: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json(documents);
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}

export async function POST(req) {
  const { session, error: accessError } = await authorizeApi(req);
  if (accessError) return accessError;
  try {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const projectId = formData.get('projectId');
    const title = formData.get('title');
    const docNumber = formData.get('docNumber');
    const revision = formData.get('revision');
    const category = formData.get('category');
    const targets = formData.get('targets'); // Expected JSON string
    const file = formData.get('file');

    if (!projectId || !title || !docNumber || !category || !file) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    if (typeof file.arrayBuffer !== 'function' || file.size > 4 * 1024 * 1024 || !/\.(pdf|png|jpe?g|docx?|xlsx?|dwg|dxf)$/i.test(file.name)) {
      return NextResponse.json({ error: 'File harus PDF, gambar, Office, atau CAD; maksimum 4 MB.' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const id = randomUUID();
    const fileUrl = '/api/documents/' + id + '/download';
    const document = await prisma.document.create({
      data: {
        id,
        content: { create: { data: buffer } },
        projectId,
        title,
        docNumber,
        revision: revision || 'A',
        category,
        targets: targets || '[]',
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        uploadedBy: session.user.id
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        uploader: { select: { id: true, name: true } }
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        module: 'ENGINEERING_DOC',
        recordId: document.id,
        newValue: JSON.stringify({ title, docNumber, category }),
      }
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
