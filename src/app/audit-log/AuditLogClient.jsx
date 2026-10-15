'use client'
import { apiFetch } from '@/lib/client-api';

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  History, Search, RefreshCw, ChevronLeft, ChevronRight, Eye, X
} from 'lucide-react'

export default function AuditLogClient() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  
  const [selectedLog, setSelectedLog] = useState(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams({ page, limit: 20 })
      if (search) query.append('search', search)
      if (moduleFilter) query.append('module', moduleFilter)
      if (actionFilter) query.append('action', actionFilter)

      const res = await apiFetch(`/api/audit-log?${query}`)
      const data = await res.json()
      
      if (res.ok) {
        setLogs(data.logs)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page,search,moduleFilter,actionFilter])

  useEffect(() => { const timer=setTimeout(fetchLogs,300); return ()=>clearTimeout(timer); }, [fetchLogs])



  const getActionColor = (action) => {
    switch(action) {
      case 'CREATE': return { bg: '#dcfce7', color: '#16a34a', border: '#bbf7d0' }
      case 'UPDATE': return { bg: '#dbeafe', color: '#2563eb', border: '#bfdbfe' }
      case 'DELETE': return { bg: '#fee2e2', color: '#dc2626', border: '#fecaca' }
      case 'APPROVE': return { bg: '#d1fae5', color: '#059669', border: '#a7f3d0' }
      case 'REJECT': return { bg: '#ffedd5', color: '#ea580c', border: '#fed7aa' }
      default: return { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Top Controls */}
      <div style={{
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--gray-200)',
        boxShadow: 'var(--shadow-sm)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{
              position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)', color: 'var(--gray-400)',
              pointerEvents: 'none',
            }} />
            <input
              type="text"
              placeholder="Cari nama pengguna..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                paddingLeft: 38, paddingRight: 14, paddingTop: 9, paddingBottom: 9,
                border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-md)',
                fontSize: 13.5, outline: 'none', color: 'var(--gray-800)',
                width: 220, fontFamily: 'var(--font-sans)',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--navy-400)'}
              onBlur={e => e.target.style.borderColor = 'var(--gray-200)'}
            />
          </div>

          {/* Module Filter */}
          <select
            value={moduleFilter}
            onChange={e => setModuleFilter(e.target.value)}
            style={{
              padding: '9px 14px', border: '1.5px solid var(--gray-200)',
              borderRadius: 'var(--radius-md)', fontSize: 13.5,
              color: 'var(--gray-700)', fontFamily: 'var(--font-sans)',
              background: 'white', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="">Semua Modul</option>
            <option value="USERS">Pengguna</option>
            <option value="PROJECTS">Proyek</option>
            <option value="HR">HR / Absensi</option>
            <option value="PAYROLL">Payroll</option>
            <option value="FINANCE">Keuangan / AP</option>
            <option value="PROCUREMENT">Procurement</option>
            <option value="WORKSHOP">Workshop</option>
          </select>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            style={{
              padding: '9px 14px', border: '1.5px solid var(--gray-200)',
              borderRadius: 'var(--radius-md)', fontSize: 13.5,
              color: 'var(--gray-700)', fontFamily: 'var(--font-sans)',
              background: 'white', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="">Semua Aksi</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="APPROVE">APPROVE</option>
            <option value="REJECT">REJECT</option>
          </select>
        </div>

        <button
          className="btn btn-outline"
          onClick={() => { setPage(1); fetchLogs(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
        >
          <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
      </div>

      {/* Table Card */}
      <div className="card">
        <div className="table-wrapper" style={{ borderRadius: 0, border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Tanggal &amp; Waktu</th>
                <th>Pengguna</th>
                <th>Modul</th>
                <th>Aksi</th>
                <th>Record ID</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--gray-400)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--navy-400)' }} />
                      <span style={{ fontSize: 13.5 }}>Memuat data audit log...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--gray-400)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <History size={32} style={{ opacity: 0.4 }} />
                      <span style={{ fontSize: 13.5 }}>Tidak ada riwayat aktivitas ditemukan.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const actionStyle = getActionColor(log.action)
                  return (
                    <tr key={log.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-800)' }}>
                          {new Date(log.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginTop: 2 }}>
                          {new Date(log.createdAt).toLocaleTimeString('id-ID')}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-800)' }}>
                          {log.user?.name || 'Unknown User'}
                        </div>
                        <div style={{
                          fontSize: 11, color: 'var(--gray-500)',
                          background: 'var(--gray-100)', borderRadius: 'var(--radius-full)',
                          padding: '2px 8px', display: 'inline-block', marginTop: 3,
                        }}>
                          {log.user?.role || 'N/A'}
                        </div>
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--gray-700)', fontSize: 13 }}>
                        {log.module}
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px',
                          borderRadius: 6, letterSpacing: '0.3px',
                          background: actionStyle.bg, color: actionStyle.color,
                          border: `1px solid ${actionStyle.border}`,
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--gray-500)' }}>
                        {log.recordId}
                      </td>
                      <td>
                        <button
                          onClick={() => setSelectedLog(log)}
                          title="Lihat Detail"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '6px', borderRadius: 6,
                            color: 'var(--gray-400)', transition: 'all 0.15s',
                            display: 'flex', alignItems: 'center',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-100)'; e.currentTarget.style.color = 'var(--navy-600)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--gray-400)'; }}
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px', borderTop: '1px solid var(--gray-100)',
            background: 'var(--gray-50)',
          }}>
            <span style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 500 }}>
              Halaman {page} dari {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={15} />
              </button>
              <button className="btn btn-outline btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Detail */}
      <AnimatePresence>
        {selectedLog && (
          <div className="modal-backdrop" onClick={() => setSelectedLog(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2 }}
              style={{ maxWidth: 800, width: '100%', background: 'white', borderRadius: 'var(--radius-xl)', padding: 28, boxShadow: 'var(--shadow-xl)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>Detail Aktivitas</h3>
                  <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                    ID: <span style={{ fontFamily: 'monospace' }}>{selectedLog.id}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 4, borderRadius: 6 }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--gray-700)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-400)'}
                >
                  <X size={22} />
                </button>
              </div>

              {/* Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ background: 'var(--gray-50)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-100)' }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Pengguna</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--gray-800)' }}>{selectedLog.user?.name} ({selectedLog.user?.role})</div>
                </div>
                <div style={{ background: 'var(--gray-50)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-100)' }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Aksi &amp; Modul</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--gray-800)' }}>{selectedLog.action} — {selectedLog.module}</div>
                </div>
              </div>

              {/* JSON Diff */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red-500)' }} />
                    Sebelum
                  </div>
                  <pre style={{
                    background: '#1e293b', color: '#94a3b8', padding: 16,
                    borderRadius: 'var(--radius-md)', fontSize: 11.5,
                    overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: 380,
                    overflowY: 'auto', lineHeight: 1.6, margin: 0,
                  }}>
                    {selectedLog.oldValue ? JSON.stringify(JSON.parse(selectedLog.oldValue), null, 2) : 'null'}
                  </pre>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green-500)' }} />
                    Sesudah
                  </div>
                  <pre style={{
                    background: '#1e293b', color: '#94a3b8', padding: 16,
                    borderRadius: 'var(--radius-md)', fontSize: 11.5,
                    overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: 380,
                    overflowY: 'auto', lineHeight: 1.6, margin: 0,
                  }}>
                    {selectedLog.newValue ? JSON.stringify(JSON.parse(selectedLog.newValue), null, 2) : 'null'}
                  </pre>
                </div>
              </div>

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setSelectedLog(null)}>Tutup</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
