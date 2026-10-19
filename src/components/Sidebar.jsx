'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard, Building2, LineChart, Ruler,
  Wrench, Package, ShoppingCart, ShoppingBag,
  Landmark, Banknote, Users, CreditCard, UserCog,
  Database, History, LogOut, Truck, X, ChevronDown,
} from 'lucide-react';
import { useDialog } from './DialogProvider';
import { ROLE_LABELS, initials } from '@/lib/ui-labels';
import { MODULE_TABS, currentTab, tabsFor } from '@/lib/module-tabs';

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

const isActiveHref = (pathname, href) => pathname === href || pathname.startsWith(href + '/');

// Setiap halaman merender AppLayout-nya sendiri, jadi Sidebar dipasang ulang
// tiap kali halaman berganti. Posisi gulir dan modul yang dibuka/ditutup
// disimpan di sini agar tidak kembali ke awal. Hanya diubah di browser.
const navMemory = { scrollTop: 0, expanded: {}, activeHref: null, anchor: null };

export default function Sidebar({ user, isOpen, setIsOpen }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showConfirm } = useDialog();
  const navRef = useRef(null);
  const activeHref = NAV_ITEMS.flatMap((s) => s.items).find((i) => isActiveHref(pathname, i.href))?.href ?? null;
  // Pilihan buka/tutup manual per modul. Modul aktif terbuka secara bawaan;
  // saat berpindah ke modul lain, modul tujuannya dibuka kembali.
  const [expanded, setExpanded] = useState(() => {
    if (activeHref === navMemory.activeHref) return navMemory.expanded;
    const next = { ...navMemory.expanded };
    delete next[activeHref];
    return next;
  });

  useEffect(() => {
    navMemory.expanded = expanded;
    navMemory.activeHref = activeHref;
  }, [expanded, activeHref]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    nav.scrollTop = navMemory.scrollTop;
    const anchor = navMemory.anchor;
    navMemory.anchor = null;
    const current = nav.querySelector('[aria-current="page"]');
    if (current) {
      const box = nav.getBoundingClientRect();
      if (anchor && current.getAttribute('href') === anchor.href) {
        // Menu yang baru diklik tetap di posisi yang sama di layar, walau
        // sub-menu modul sebelumnya ikut tertutup dan isi sidebar bergeser.
        nav.scrollTop += current.getBoundingClientRect().top - box.top - anchor.top;
      }
      // Pastikan menu aktif terlihat, mis. saat halaman dibuka dari luar sidebar.
      const item = current.getBoundingClientRect();
      if (item.top < box.top) nav.scrollTop -= box.top - item.top + 8;
      else if (item.bottom > box.bottom) nav.scrollTop += item.bottom - box.bottom + 8;
    }
    // Simpan juga saat dilepas: event scroll bisa belum terkirim.
    return () => { navMemory.scrollTop = nav.scrollTop; };
  }, [pathname]);

  const rememberClick = (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const top = link.getBoundingClientRect().top - e.currentTarget.getBoundingClientRect().top;
    navMemory.anchor = { href: link.getAttribute('href'), top };
  };

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

      <nav
        ref={navRef}
        className="sidebar-nav"
        onScroll={(e) => { navMemory.scrollTop = e.currentTarget.scrollTop; }}
        onClickCapture={rememberClick}
      >
        {NAV_ITEMS.map((section) => {
          const visibleItems = section.items.filter((item) => hasAccess(item.roles));
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.section} className="nav-section">
              <div className="nav-section-label">{section.section}</div>
              {visibleItems.map((item) => {
                const isActive = item.href === activeHref;
                const Icon = item.icon;
                const subs = tabsFor(item.href, role);
                const config = MODULE_TABS[item.href];
                const open = subs.length > 0 && (expanded[item.href] ?? isActive);
                const activeSub = isActive && config ? currentTab(item.href, searchParams.get(config.param), role) : null;
                const subId = `nav-sub${item.href.replace(/\//g, '-')}`;
                return (
                  <div key={item.href} className={`nav-group ${open ? 'open' : ''}`}>
                    {subs.length > 0 ? (
                      // Seluruh baris modul menjadi tombol buka/tutup; navigasi
                      // ke halaman modul lewat sub-menunya.
                      <button
                        type="button"
                        className={`nav-item has-sub ${isActive ? 'active' : ''}`}
                        aria-expanded={open}
                        aria-controls={subId}
                        onClick={() => setExpanded((e) => ({ ...e, [item.href]: !open }))}
                      >
                        <Icon className="nav-icon" aria-hidden />
                        <span className="nav-label">{item.label}</span>
                        <ChevronDown className="nav-caret" aria-hidden />
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        className={`nav-item ${isActive ? 'active' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => setIsOpen?.(false)}
                      >
                        <Icon className="nav-icon" aria-hidden />
                        <span className="nav-label">{item.label}</span>
                      </Link>
                    )}
                    {open && (
                      <div className="nav-sub" id={subId}>
                        {subs.map(([key, label]) => {
                          const subActive = activeSub === key;
                          return (
                            <Link
                              key={key}
                              href={`${item.href}?${config.param}=${key}`}
                              className={`nav-subitem ${subActive ? 'active' : ''}`}
                              aria-current={subActive ? 'page' : undefined}
                              onClick={() => setIsOpen?.(false)}
                            >
                              {label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
