/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ] }, {
      // Web absensi lapangan memindai kartu QR lewat kamera; aturan terakhir menimpa aturan di atas.
      source: '/absen',
      headers: [{ key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' }],
    }, {
      // Service worker web absensi harus selalu diperiksa ulang agar pembaruan cepat sampai ke HP PIC.
      source: '/absen-sw.js',
      headers: [{ key: 'Cache-Control', value: 'no-cache' }],
    }];
  },
  outputFileTracingIncludes: {
    '/*': ['./prisma/certs/supabase-ca.crt'],
  },
};

export default nextConfig;
