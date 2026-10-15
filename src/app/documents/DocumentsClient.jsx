'use client'
import { apiFetch } from '@/lib/client-api';

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileText, UploadCloud, Search, Download, Trash2, 
  XCircle, AlertCircle, File, Building, Target, BookOpen, Clock
} from 'lucide-react'
import { useDialog } from '@/components/DialogProvider'

export default function DocumentsClient({ initialDocuments, projects, user }) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const { showAlert, showConfirm } = useDialog()
  
  // Form State
  const [formData, setFormData] = useState({
    projectId: '',
    title: '',
    docNumber: '',
    revision: 'A',
    category: 'DRAWING',
    targets: []
  })
  const [selectedFile, setSelectedFile] = useState(null)

  const filteredDocs = documents.filter(d => 
    d.title.toLowerCase().includes(search.toLowerCase()) || 
    d.docNumber.toLowerCase().includes(search.toLowerCase()) ||
    (d.project?.name || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleOpenModal = () => {
    setErrorMsg('')
    setFormData({
      projectId: projects[0]?.id || '',
      title: '',
      docNumber: '',
      revision: 'A',
      category: 'DRAWING',
      targets: ['SITE']
    })
    setSelectedFile(null)
    setIsModalOpen(true)
  }

  const handleTargetToggle = (target) => {
    setFormData(prev => {
      const targets = prev.targets.includes(target)
        ? prev.targets.filter(t => t !== target)
        : [...prev.targets, target]
      return { ...prev, targets }
    })
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!selectedFile) {
      setErrorMsg('Harap lampirkan file dokumen.')
      return
    }
    if (!formData.projectId) {
      setErrorMsg('Pilih proyek terlebih dahulu.')
      return
    }

    setUploading(true)
    setErrorMsg('')

    try {
      const data = new FormData()
      data.append('projectId', formData.projectId)
      data.append('title', formData.title)
      data.append('docNumber', formData.docNumber)
      data.append('revision', formData.revision)
      data.append('category', formData.category)
      data.append('targets', JSON.stringify(formData.targets))
      data.append('file', selectedFile)

      const res = await apiFetch('/api/documents', {
        method: 'POST',
        body: data // Don't set Content-Type header, let browser set it with boundary
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Terjadi kesalahan')

      setDocuments([result, ...documents])
      setIsModalOpen(false)
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    const confirmed = await showConfirm('Apakah Anda yakin ingin menghapus dokumen ini?', 'Konfirmasi');
    if (!confirmed) return
    
    try {
      const res = await apiFetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error || 'Gagal menghapus')
      }
      setDocuments(documents.filter(d => d.id !== id))
    } catch (err) {
      await showAlert(err.message, 'Error')
    }
  }

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'DRAWING': return 'badge-info'
      case 'SPECIFICATION': return 'badge-warning'
      case 'REPORT': return 'badge-success'
      case 'CALCULATION': return 'badge-danger'
      default: return 'badge-neutral'
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <motion.div 
      style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Top Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <Search style={{ width: '20px', height: '20px', position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input 
            type="text" 
            placeholder="Cari Dokumen..." 
            className="form-input"
            style={{ paddingLeft: '44px', borderRadius: '12px', background: 'white', height: '44px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button 
          className="btn btn-primary" 
          style={{ height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
          disabled={user.role==='WORKSHOP'} onClick={handleOpenModal}
        >
          <UploadCloud size={18} /> 
          <span>Unggah Dokumen</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ boxShadow: 'var(--shadow-md)', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table>
            <thead style={{ background: 'var(--gray-50)' }}>
              <tr>
                <th>Dokumen</th>
                <th>Proyek</th>
                <th>Kategori & Revisi</th>
                <th>Target Distribusi</th>
                <th>Tanggal Unggah</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
                    Tidak ada dokumen ditemukan.
                  </td>
                </tr>
              ) : filteredDocs.map((d) => {
                const targets = JSON.parse(d.targets || '[]')
                return (
                  <tr key={d.id} style={{ transition: 'background 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)' } onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent' }>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                          width: '40px', height: '40px', borderRadius: '10px', 
                          background: 'var(--blue-50)', color: 'var(--blue-600)', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <FileText size={20} />
                        </div>
                        <div>
                          <p style={{ fontWeight: 700, color: 'var(--gray-900)', fontSize: '14px' }}>{d.title}</p>
                          <p style={{ fontSize: '12.5px', color: 'var(--gray-500)', marginTop: '2px', fontWeight: 500 }}>
                            {d.docNumber} • {formatFileSize(d.fileSize)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--navy-800)', fontSize: '13px' }}>
                        {d.project?.name || 'Unknown'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`badge ${getCategoryColor(d.category)}`} style={{ padding: '6px 10px', borderRadius: '8px', fontWeight: 600, fontSize: '11px' }}>
                          {d.category}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-600)', background: 'var(--gray-100)', padding: '4px 8px', borderRadius: '6px' }}>
                          Rev {d.revision}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {targets.includes('SITE') && (
                          <span className="badge badge-success" style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>SITE</span>
                        )}
                        {targets.includes('WORKSHOP') && (
                          <span className="badge badge-warning" style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>WORKSHOP</span>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--gray-600)', fontSize: '13px', fontWeight: 500 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} />
                        {new Date(d.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '2px' }}>Oleh {d.uploader?.name}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <a 
                          href={d.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn-ghost" 
                          style={{ padding: '8px', borderRadius: '8px', color: 'var(--blue-600)', display: 'inline-flex' }}
                          title="Unduh / Lihat Dokumen"
                        >
                          <Download size={18} />
                        </a>
                        <button 
                          className="btn-ghost" 
                          style={{ padding: '8px', borderRadius: '8px', color: 'var(--red-600)' }}
                          disabled={user.role==='WORKSHOP'} onClick={() => handleDelete(d.id)}
                          title="Hapus Dokumen"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            style={{ 
              position: 'fixed', inset: 0, zIndex: 999, 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)'
            }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div 
              style={{ 
                background: 'white', borderRadius: '20px', width: '100%', maxWidth: '600px', 
                boxShadow: 'var(--shadow-|e)', overflow: 'hidden'
              }}
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            >
              <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy-900)' }}>Unggah Dokumen Baru</h3>
                  <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '4px' }}>
                    Unggah dokumen teknis untuk didistribusikan ke lokasi kerja.
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: '4px' }}>
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleUpload} style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {errorMsg && (
                  <div style={{ padding: '12px 16px', background: 'var(--red-50)', color: 'var(--red-600)', borderRadius: '10px', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} /> {errorMsg}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label required">Proyek Terkait</label>
                  <select 
                    className="form-select" 
                    style={{ height: '44px', borderRadius: '10px', fontWeight: 500 }}
                    value={formData.projectId} onChange={e => setFormData({...formData, projectId: e.target.value})}
                    required
                  >
                    <option value="" disabled>Pilih Proyek</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                   ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label required">Nomor Dokumen</label>
                    <input 
                      type="text" required
                      className="form-input" 
                      placeholder="DWG-STR-001"
                      style={{ height: '44px', borderRadius: '10px' }}
                      value={formData.docNumber} onChange={e => setFormData({...formData, docNumber: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Revisi</label>
                    <input 
                      type="text" required
                      className="form-input" 
                      placeholder="00"
                      style={{ height: '44px', borderRadius: '10px' }}
                      value={formData.revision} onChange={e => setFormData({...formData, revision: e.target.value.toUpperCase()})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label required">Judul Dokumen</label>
                  <input 
                    type="text" required
                    className="form-input" 
                    placeholder="Judul Dokumen"
                    style={{ height: '44px', borderRadius: '10px' }}
                    value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label required">Kategori</label>
                    <select 
                      className="form-select" 
                      style={{ height: '44px', borderRadius: '10px', fontWeight: 500 }}
                      value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}
                    >
                      <option value="DRAWING">Blueprint</option>
                      <option value="SPECIFICATION">Spesifikasi</option>
                      <option value="CALCULATION">Kalkulasi</option>
                      <option value="REPORT">Laporan</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label required">Target Distribusi</label>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: 'var(--gray-700)' }}>
                        <input 
                          type="checkbox" 
                          checked={formData.targets.includes('SITE')}
                          onChange={() => handleTargetToggle('SITE')}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--navy-600)' }}
                        /> 
                        Tim Lapangan
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: 'var(--gray-700)' }}>
                        <input 
                          type="checkbox" 
                          checked={formData.targets.includes('WORKSHOP')}
                          onChange={() => handleTargetToggle('WORKSHOP')}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--navy-600)' }}
                        /> 
                        Tim Pabrikasi
                      </label>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label required">Pilih File</label>
                  <div 
                    style={{ 
                      border: '2px dashed var(--gray-300)', borderRadius: '12px', padding: '24px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                      background: 'var(--gray-50)', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--navy-500)'; e.currentTarget.style.background = 'var(--navy-50)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--gray-300)'; e.currentTarget.style.background = 'var(--gray-50)' }}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      style={{ display: 'none' }}
                      accept=".pdf,.dwg,.doc,.docx,.xls,.xlsx,.zip,.jpg,.jpeg,.png"
                    />
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', color: 'var(--navy-600)' }}>
                      <File size={24} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontWeight: 600, color: 'var(--gray-900)', fontSize: '14px' }}>
                        {selectedFile ? selectedFile.name : 'Klik untuk memilih file'}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>
                        {selectedFile ? formatFileSize(selectedFile.size) : 'PDF, DWG, Office, Image, Zip (Max 50MB)'}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', paddingTop: '24px', borderTop: '1px solid var(--gray-100)' }}>
                  <button type="button" className="btn btn-ghost" style={{ padding: '10px 24px', borderRadius: '10px', fontWeight: 600 }} onClick={() => setIsModalOpen(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: '10px', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'center' }} disabled={uploading}>
                    {uploading ? 'Mengunggah...' : <><UploadCloud size={18} /> Unggah & Simpan</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
