import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { canAccess, homePath, KIOSK_ROLE } from '@/lib/access';

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith('/api/')) return NextResponse.next();
  // Domain khusus absensi (mis. absen.prohaba.co.id) langsung membuka web absensi lapangan.
  const absenHost = process.env.ABSEN_HOST && req.nextUrl.hostname === process.env.ABSEN_HOST;
  if (pathname === '/' || pathname === '/login') {
    if (!req.auth?.user) return pathname === '/' && absenHost ? NextResponse.redirect(new URL('/login', req.url)) : NextResponse.next();
    return NextResponse.redirect(new URL(absenHost ? '/absen' : homePath(req.auth.user.role), req.url));
  }
  if (!req.auth?.user) return NextResponse.redirect(new URL('/login', req.url));
  if (!canAccess(req.auth.user.role, pathname)) {
    if (req.auth.user.role === KIOSK_ROLE) return NextResponse.redirect(new URL('/absen', req.url));
    return new NextResponse('Forbidden', { status: 403 });
  }
  return NextResponse.next();
});
export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|brand/|favicon.ico|icon.png|apple-icon.png|absen-sw.js|absen.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
};
