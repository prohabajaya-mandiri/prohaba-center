import { authorizeApi } from '@/lib/api-access';
import { prisma } from '@/lib/prisma';

export async function GET(request, { params }) {
  const { error } = await authorizeApi(request);
  if (error) return error;
  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id }, include: { content: true } });
  if (!document?.content) return Response.json({ error: 'File tidak ditemukan.' }, { status: 404 });
  return new Response(document.content.data, { headers: {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(document.fileName),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}
