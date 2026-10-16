import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';

// Font adaptif: perangkat Apple memakai font sistem (SF Pro asli, otomatis
// Text/Display sesuai ukuran) lewat -apple-system di globals.css. Perangkat
// lain memakai Inter, yang juga punya sumbu optical size (opsz) sehingga
// ikut berganti gaya Text/Display seperti SF Pro.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
  axes: ['opsz'],
});

export const metadata = {
  title: { default: 'ERP Prohaba Jaya Mandiri', template: '%s · ERP Prohaba' },
  description: 'Sistem Manajemen Terintegrasi PT. Prohaba Jaya Mandiri — Konstruksi Pertambangan',
  applicationName: 'ERP Prohaba',
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
