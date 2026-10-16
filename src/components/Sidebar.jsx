'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard, Building2, LineChart, Ruler,
  Wrench, Package, ShoppingCart, ShoppingBag,
  Landmark, Banknote, Users, CreditCard, UserCog,
  Database, History, LogOut, Truck, X,
} from 'lucide-react';
import { useDialog } from './DialogProvider';
import { ROLE_LABELS, initials } from '@/lib/ui-labels';

const NAV_ITEMS = [
  {
    section: 'Utama',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ALL'] },
      { href: '/projects', label: 'Proyek', icon: Building2, roles: ['ALL'] },
    ],
  },
  {
    section: 'Operasional',
    items: [
      { href: '/scurve', label: 'S-Curve & Progress', icon: LineChart, roles: ['TOP_MANAGEMENT', 'PJO', 'FINANCE', 'ENGINEERING'] },
      { href: '/documents', label: 'Dokumen Engineering', icon: Ruler, roles: ['TOP_MANAGEMENT', 'ENGINEERING', 'PJO', 'WORKSHOP'] },
      { href: '/workshop', label: 'Workshop', icon: Wrench, roles: ['TOP_MANAGEMENT', 'ENGINEERING', 'WORKSHOP', 'PJO'] },
      { href: '/material-request', label: 'Material Request', icon: Package, roles: ['TOP_MANAGEMENT', 'PJO', 'LOGISTIK'] },
      { href: '/logistik', label: 'Logistik & Kendaraan', icon: Truck, roles: ['TOP_MANAGEMENT', 'PJO', 'LOGISTIK'] },
      { href: '/procurement', label: 'Procurement & PO', icon: ShoppingCart, roles: ['TOP_MANAGEMENT', 'LOGISTIK', 'FINANCE'] },
      { href: '/site-purchase', label: 'Pembelian Site', icon: ShoppingBag, roles: ['TOP_MANAGEMENT', 'PJO', 'LOGISTIK', 'FINANCE'] },
    ],
  },
  {
    section: 'Keuangan',
    items: [
      { href: '/finance', label: 'Keuangan & Hutang', icon: Landmark, roles: ['TOP_MANAGEMENT', 'FINANCE'] },
      { href: '/revenue', label: 'Pendapatan', icon: Banknote, roles: ['TOP_MANAGEMENT', 'FINANCE'] },
    ],
  },
  {
    section: 'SDM',
    items: [
      { href: '/hr', label: 'Karyawan & Absensi', icon: Users, roles: ['TOP_MANAGEMENT', 'HRD', 'PJO'] },
      { href: '/payroll', label: 'Payroll', icon: CreditCard, roles: ['TOP_MANAGEMENT', 'HRD', 'FINANCE'] },
    ],
  },
  {
    section: 'Sistem',
    items: [
      { href: '/master-data', label: 'Master Data', icon: Database, roles: ['TOP_MANAGEMENT', 'HRD', 'LOGISTIK', 'FINANCE'] },
      { href: '/users', label: 'Pengguna', icon: UserCog, roles: ['TOP_MANAGEMENT'] },
      { href: '/audit-log', label: 'Audit Log', icon: History, roles: ['TOP_MANAGEMENT'] },
    ],
  },
];

export default function Sidebar({ user, isOpen, setIsOpen }) {
  const pathname = usePathname();
  const { showConfirm } = useDialog();
  if (!user) return null;

  const role = user.role || 'GUEST';
  const hasAccess = (roles) => roles.includes('ALL') || roles.includes(role);

  const handleLogout = async () => {
    if (await showConfirm('Apakah Anda yakin ingin keluar dari aplikasi?', 'Keluar')) {
      signOut({ callbackUrl: '/login' });
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`} aria-label="Navigasi utama">
      <div className="sidebar-logo">
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, color: 'inherit' }}>
          <Image src="/brand/prohaba-mark.png" alt="Logo Prohaba Jaya Mandiri" width={46} height={40} priority />
          <span className="sidebar-logo-text">
            <span className="sidebar-logo-name" style={{ display: 'block' }}>Prohaba Jaya Mandiri</span>
            <span className="sidebar-logo-sub" style={{ display: 'block' }}>ERP Konstruksi</span>
          </span>
        </Link>
        <button type="button" className="sidebar-close" onClick={() => setIsOpen?.(false)} aria-label="Tutup navigasi">
          <X size={20} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((section) => {
          const visibleItems = section.items.filter((item) => hasAccess(item.roles));
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.section} className="nav-section">
              <div className="nav-section-label">{section.section}</div>
              {visibleItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setIsOpen?.(false)}
                  >
                    <Icon className="nav-icon" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar" aria-hidden>{initials(user.name)}</div>
          <div className="user-info">
            <div className="user-name">{user.name || 'Pengguna'}</div>
            <div className="user-role">{ROLE_LABELS[role] || role}</div>
          </div>
          <button type="button" onClick={handleLogout} className="icon-btn danger" title="Keluar" aria-label="Keluar">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
