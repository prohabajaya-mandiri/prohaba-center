'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { statusLabel, statusTone } from '@/lib/ui-labels';

// ─── Badge status ───────────────────────────────────────────────────────────
export function StatusBadge({ value, labels, tones, icon: Icon }) {
  if (!value) return <span className="muted">-</span>;
  const label = labels?.[value] ?? statusLabel(value);
  const tone = tones?.[value] ?? statusTone(value);
  return (
    <span className={`badge badge-${tone}`}>
      {Icon && <Icon aria-hidden />}
      {label}
    </span>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────
// Satu bentuk modal untuk seluruh aplikasi: judul, isi yang bisa digulir, dan
// kaki berisi tombol. Esc dan klik di luar panel menutup modal.
export function Modal({ open = true, onClose, title, subtitle, size = '', children, footer, busy = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && !busy && onClose?.();
    window.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose, busy]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose?.()}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            <div className="modal-title">{title}</div>
            {subtitle && <div className="modal-subtitle">{subtitle}</div>}
          </div>
          <button type="button" className="icon-btn modal-close" onClick={onClose} disabled={busy} aria-label="Tutup">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Kolom pencarian ────────────────────────────────────────────────────────
export function SearchField({ value, onChange, placeholder = 'Cari…', label = 'Cari' }) {
  return (
    <div className="search-field">
      <Search size={18} aria-hidden />
      <input
        type="search"
        className="form-input"
        placeholder={placeholder}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── Baris kosong pada tabel ────────────────────────────────────────────────
export function EmptyRow({ colSpan, title = 'Belum ada data', hint }) {
  return (
    <tr>
      <td colSpan={colSpan} className="cell-empty">
        <div style={{ fontWeight: 600, color: 'var(--gray-700)' }}>{title}</div>
        {hint && <div style={{ marginTop: 4, fontSize: 13.5 }}>{hint}</div>}
      </td>
    </tr>
  );
}

// ─── Dokumen cetak ──────────────────────────────────────────────────────────
// Dirender ke <body> di luar kerangka aplikasi. Saat mencetak, body diberi
// kelas `printing-doc` sehingga hanya dokumen ini yang tampil di kertas.
const subscribe = () => () => {};
export function PrintDoc({ children }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(<div className="print-doc"><div className="print-doc-inner">{children}</div></div>, document.body);
}

export function printDocument() {
  const cleanup = () => {
    document.body.classList.remove('printing-doc');
    window.removeEventListener('afterprint', cleanup);
  };
  document.body.classList.add('printing-doc');
  window.addEventListener('afterprint', cleanup);
  // Beri satu frame agar portal sempat dirender sebelum dialog cetak terbuka.
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}
