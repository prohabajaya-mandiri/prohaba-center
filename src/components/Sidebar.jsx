'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard, Building2, LineChart, Ruler,
  Wrench, Package, ShoppingCart, ShoppingBag,
  DollarSign, Banknote, Users, Calendar,
  CreditCard, UserCog, History, LogOut,
  Truck
} from 'lucide-react';
import { useDialog } from './DialogProvider';


const ROLE_LABELS = {
  TOP_MANAGEMENT: 'Top Management',
  HRD: 'HRD',
  PJO: 'P.J. Operasional',
  LOGISTIK: 'Logistik & Procurement',
  FINANCE: 'Finance',
  ENGINEERING: 'Engineering',
  WORKSHOP: 'Workshop',
};

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
      { href: '/finance', label: 'Keuangan & AP', icon: DollarSign, roles: ['TOP_MANAGEMENT', 'FINANCE'] },
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
      { href: '/master-data', label: 'Master Data', icon: UserCog, roles: ['TOP_MANAGEMENT','HRD','LOGISTIK','FINANCE'] },
      { href: '/users', label: 'Pengguna', icon: UserCog, roles: ['TOP_MANAGEMENT'] },
      { href: '/audit-log', label: 'Audit Log', icon: History, roles: ['TOP_MANAGEMENT'] },
          ],
  },
];

export default function Sidebar({ user, isOpen, setIsOpen }) {
  const pathname = usePathname();
  const session = user ? { user } : null;
  const { showConfirm } = useDialog();
  const userRole = session?.user?.role || 'GUEST';

  const initials = session?.user?.name
    ? session.user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const hasAccess = (roles) => roles.includes('ALL') || roles.includes(userRole);

  if (!session) return null; // Don't render sidebar if not logged in

  const handleLogout = async () => {
    const confirmed = await showConfirm('Apakah Anda yakin ingin keluar dari aplikasi?');
    if (confirmed) {
      signOut({ callbackUrl: '/login' });
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-inner">
          <div className="sidebar-logo-icon">P</div>
          <div className="sidebar-logo-text">
            <div className="sidebar-logo-name">Prohaba Jaya Mandiri</div>
            <div className="sidebar-logo-sub">ERP Konstruksi</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((section) => {
          const visibleItems = section.items.filter(item => hasAccess(item.roles));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.section} className="nav-section">
              <div className="nav-section-label">{section.section}</div>
              {visibleItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setIsOpen && setIsOpen(false)}
                  >
                    <Icon size={18} className="nav-icon" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="nav-badge">{item.badge}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="sidebar-footer">
        <div className="sidebar-user" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name" style={{ fontSize: '13px' }}>{session?.user?.name || 'Pengguna'}</div>
              <div className="user-role" style={{ fontSize: '11px' }}>{ROLE_LABELS[userRole] || userRole}</div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--red-500)', 
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px'
            }}
            title="Keluar"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
