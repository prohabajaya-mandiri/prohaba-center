'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { ChevronDown, LogOut, Menu } from 'lucide-react';
import { ROLE_LABELS, initials } from '@/lib/ui-labels';

export default function Header({ title, subtitle, user, onMenuClick }) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    if (!showUserMenu) return;
    const onKey = (e) => e.key === 'Escape' && setShowUserMenu(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showUserMenu]);

  const today = new Date();

  return (
    <header className="header">
      <button type="button" className="icon-btn mobile-menu-btn" onClick={onMenuClick} aria-label="Buka navigasi">
        <Menu size={22} />
      </button>

      <div className="header-breadcrumb">
        <h1 className="header-title">{title}</h1>
        {subtitle && <div className="header-subtitle">{subtitle}</div>}
      </div>

      <div className="header-actions">
        <div className="header-date" suppressHydrationWarning>
          <strong>{today.toLocaleDateString('id-ID', { weekday: 'long' })}</strong>
          {today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>

        <div className="user-menu">
          <button
            type="button"
            className="user-menu-trigger"
            onClick={() => setShowUserMenu((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
          >
            <span className="user-avatar" aria-hidden>{initials(user?.name)}</span>
            <span className="user-menu-text">
              <span className="user-menu-name">{user?.name || 'Pengguna'}</span>
              <span className="user-menu-role">{ROLE_LABELS[user?.role] || user?.role}</span>
            </span>
            <ChevronDown size={16} style={{ color: 'var(--gray-400)' }} aria-hidden />
          </button>

          {showUserMenu && (
            <>
              <div className="menu-backdrop" onClick={() => setShowUserMenu(false)} />
              <div className="menu-panel" role="menu">
                <div className="menu-head">
                  <strong>{user?.name}</strong>
                  <span>{user?.email}</span>
                </div>
                <button type="button" role="menuitem" className="menu-item danger" onClick={() => signOut({ callbackUrl: '/login' })}>
                  <LogOut size={17} /> Keluar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
