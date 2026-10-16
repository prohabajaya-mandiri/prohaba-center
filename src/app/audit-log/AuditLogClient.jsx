'use client'
import { apiFetch } from '@/lib/client-api';

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { EmptyRow, Modal, SearchField } from '@/components/ui'
import { ROLE_LABELS } from '@/lib/ui-labels'

// Nama modul sesuai yang benar-benar dicatat oleh layanan (lib/services/*).
const MODULES = [
  ['PROJECTS', 'Proyek'],
  ['BOQ', 'BOQ & kurva S'],
  ['ENGINEERING_DOC', 'Dokumen engineering'],
  ['WORKSHOP', 'Workshop'],
  ['MR', 'Material request'],
  ['LOGISTICS', 'Logistik & kendaraan'],
  ['PROCUREMENT', 'Procurement'],
  ['SITE_PURCHASE', 'Pembelian site'],
  ['FINANCE', 'Keuangan / hutang'],
  ['REVENUE', 'Pendapatan'],
  ['JOURNAL', 'Jurnal'],
  ['ATTENDANCE', 'Absensi'],
  ['PAYROLL', 'Payroll'],
  ['USER_MANAGEMENT', 'Pengguna'],
  ['MASTER_EMPLOYEES', 'Master pegawai'],
  ['MASTER_ASSIGNMENTS', 'Master penugasan'],
  ['MASTER_VENDORS', 'Master pemasok'],
  ['MASTER_PRICES', 'Master referensi harga'],
  ['MASTER_ACCOUNTS', 'Master akun'],
]
const MODULE_LABEL = Object.fromEntries(MODULES)

const ACTIONS = [
  ['CREATE', 'Tambah', 'success'],
  ['UPDATE', 'Ubah', 'info'],
  ['DELETE', 'Hapus', 'danger'],
  ['ARCHIVE', 'Arsipkan', 'gray'],
  ['APPROVE', 'Setujui', 'success'],
  ['REVIEW', 'Review', 'navy'],
  ['REJECT', 'Tolak', 'danger'],
  ['VOID', 'Batalkan', 'danger'],
  ['GENERATE', 'Buat payroll', 'navy'],
  ['PAYMENT', 'Pembayaran', 'warning'],
  ['PURCHASE_INVOICE', 'Faktur pembelian', 'warning'],
  ['RECEIVE', 'Terima barang', 'success'],
  ['RECEIPT', 'Lampirkan bukti', 'gray'],
  ['IMPORT', 'Impor BOQ', 'navy'],
  ['SCHEDULE', 'Jadwal BOQ', 'navy'],
  ['ACTUAL', 'Realisasi BOQ', 'navy'],
  ['POST', 'Posting jurnal', 'navy'],
]
const ACTION = Object.fromEntries(ACTIONS.map(([v, l, t]) => [v, { label: l, tone: t }]))

function pretty(raw) {
  if (raw === null || raw === undefined || raw === '') return '—'
  try {
    return JSON.stringify(typeof raw === 'string' ? JSON.parse(raw) : raw, null, 2)
  } catch {
    return String(raw)
  }
}

const preStyle = {
  background: 'var(--gray-50)', color: 'var(--gray-800)', border: '1px solid var(--gray-200)', padding: 14,
  borderRadius: 'var(--radius-md)', fontSize: 12.5, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  maxHeight: 360, lineHeight: 1.6, margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
}

export default function AuditLogClient() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedLog, setSelectedLog] = useState(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({ page, limit: 20 })
      if (search) query.append('search', search)
      if (moduleFilter) query.append('module', moduleFilter)
      if (actionFilter) query.append('action', actionFilter)
      const res = await apiFetch(`/api/audit-log?${query}`)
      const data = await res.json()
      setLogs(data.logs)
      setTotalPages(Math.max(1, data.pagination.totalPages))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, search, moduleFilter, actionFilter])

  useEffect(() => { const timer = setTimeout(fetchLogs, 300); return () => clearTimeout(timer) }, [fetchLogs])

  // Setiap perubahan filter kembali ke halaman pertama.
  const changeFilter = (setter) => (value) => { setter(value); setPage(1) }

  return (
    <div className="stack">
      <div className="toolbar">
        <SearchField value={search} onChange={changeFilter(setSearch)} placeholder="Cari nama pengguna" />
        <select className="form-select" aria-label="Filter modul" value={moduleFilter} onChange={(e) => changeFilter(setModuleFilter)(e.target.value)} style={{ width: 230, flex: '0 1 230px' }}>
          <option value="">Semua modul</option>
          {MODULES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="form-select" aria-label="Filter aksi" value={actionFilter} onChange={(e) => changeFilter(setActionFilter)(e.target.value)} style={{ width: 200, flex: '0 1 200px' }}>
          <option value="">Semua aksi</option>
          {ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div className="spacer" />
        <button className="btn btn-outline" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={loading ? 'spin' : ''} aria-hidden /> Muat ulang
        </button>
      </div>

      {error && <p role="alert" className="alert alert-danger">{error}</p>}

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Pengguna</th>
                <th>Modul</th>
                <th>Aksi</th>
                <th>ID data</th>
                <th className="num">Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading && !logs.length ? (
                <tr><td colSpan={6} className="cell-empty"><RefreshCw className="spin" size={22} style={{ margin: '0 auto 8px' }} /> Memuat riwayat aktivitas…</td></tr>
              ) : logs.length === 0 ? (
                <EmptyRow colSpan={6} title="Tidak ada riwayat aktivitas" hint={search || moduleFilter || actionFilter ? 'Coba ubah filter.' : undefined} />
              ) : logs.map((log) => {
                const action = ACTION[log.action]
                return (
                  <tr key={log.id} style={{ opacity: loading ? 0.6 : 1 }}>
                    <td className="nowrap">
                      <div style={{ color: 'var(--gray-900)', fontWeight: 500 }}>{new Date(log.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                      <div className="cell-sub">{new Date(log.createdAt).toLocaleTimeString('id-ID')}</div>
                    </td>
                    <td>
                      <div className="cell-title">{log.user?.name || 'Pengguna tidak dikenal'}</div>
                      <div className="cell-sub">{ROLE_LABELS[log.user?.role] ?? log.user?.role ?? '-'}</div>
                    </td>
                    <td>{MODULE_LABEL[log.module] ?? log.module}</td>
                    <td><span className={`badge badge-${action?.tone ?? 'gray'}`}>{action?.label ?? log.action}</span></td>
                    <td style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12.5, color: 'var(--gray-500)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.recordId}>
                      {log.recordId}
                    </td>
                    <td className="num">
                      <button className="action-btn" onClick={() => setSelectedLog(log)} title="Lihat detail" aria-label="Lihat detail aktivitas"><Eye /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pager" style={{ margin: 0, padding: '12px 20px', borderTop: '1px solid var(--gray-200)' }}>
            <span>Halaman {page} dari {totalPages}</span>
            <span className="pager-nav">
              <button className="btn btn-outline btn-sm" disabled={page === 1 || loading} onClick={() => setPage((p) => p - 1)}><ChevronLeft aria-hidden /> Sebelumnya</button>
              <button className="btn btn-outline btn-sm" disabled={page === totalPages || loading} onClick={() => setPage((p) => p + 1)}>Berikutnya <ChevronRight aria-hidden /></button>
            </span>
          </div>
        )}
      </div>

      {selectedLog && (
        <Modal
          size="modal-xl"
          title="Detail aktivitas"
          subtitle={`${new Date(selectedLog.createdAt).toLocaleString('id-ID')} · ID ${selectedLog.id}`}
          onClose={() => setSelectedLog(null)}
          footer={<button className="btn btn-outline" onClick={() => setSelectedLog(null)}>Tutup</button>}
        >
          <div className="form-stack">
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="notice info" style={{ background: 'var(--gray-50)', color: 'var(--gray-800)', borderColor: 'var(--gray-200)' }}>
                <div className="muted" style={{ fontSize: 12.5 }}>Pengguna</div>
                <strong>{selectedLog.user?.name ?? '-'}</strong> · {ROLE_LABELS[selectedLog.user?.role] ?? selectedLog.user?.role ?? '-'}
              </div>
              <div className="notice info" style={{ background: 'var(--gray-50)', color: 'var(--gray-800)', borderColor: 'var(--gray-200)' }}>
                <div className="muted" style={{ fontSize: 12.5 }}>Aksi & modul</div>
                <strong>{ACTION[selectedLog.action]?.label ?? selectedLog.action}</strong> · {MODULE_LABEL[selectedLog.module] ?? selectedLog.module}
              </div>
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              <div>
                <div className="form-label">Sebelum</div>
                <pre style={preStyle}>{pretty(selectedLog.oldValue)}</pre>
              </div>
              <div>
                <div className="form-label">Sesudah</div>
                <pre style={preStyle}>{pretty(selectedLog.newValue)}</pre>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
