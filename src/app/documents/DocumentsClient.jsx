'use client'
import { apiFetch } from '@/lib/client-api';

import { useRef, useState } from 'react'
import { FileText, UploadCloud, Download, Trash2, AlertCircle, File } from 'lucide-react'
import { useDialog } from '@/components/DialogProvider'
import { EmptyRow, Modal, SearchField } from '@/components/ui'
import { DOC_CATEGORY, fmtDate } from '@/lib/ui-labels'

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)).toLocaleString('id-ID') + ' ' + sizes[i]
}

const parseTargets = (raw) => {
  try { return JSON.parse(raw || '[]') } catch { return [] }
}

export default function DocumentsClient({ initialDocuments, projects, user }) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)
  const { showAlert, showConfirm } = useDialog()
  const canEdit = user.role !== 'WORKSHOP'

  const [formData, setFormData] = useState({ projectId: '', title: '', docNumber: '', revision: 'A', category: 'DRAWING', targets: [] })
  const [selectedFile, setSelectedFile] = useState(null)

  const q = search.trim().toLowerCase()
  const filteredDocs = documents.filter((d) =>
    !q || [d.title, d.docNumber, d.project?.name, d.project?.code].some((v) => (v || '').toLowerCase().includes(q)),
  )

  const handleOpenModal = () => {
    setErrorMsg('')
    setFormData({ projectId: projects[0]?.id || '', title: '', docNumber: '', revision: 'A', category: 'DRAWING', targets: ['SITE'] })
    setSelectedFile(null)
    setIsModalOpen(true)
  }

  const handleTargetToggle = (target) => {
    setFormData((prev) => ({
      ...prev,
      targets: prev.targets.includes(target) ? prev.targets.filter((t) => t !== target) : [...prev.targets, target],
    }))
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!selectedFile) return setErrorMsg('Lampirkan file dokumen terlebih dahulu.')
    if (!formData.projectId) return setErrorMsg('Pilih proyek terlebih dahulu.')
    if (!formData.targets.length) return setErrorMsg('Pilih minimal satu target distribusi.')
    if (selectedFile.size > 4 * 1024 * 1024) return setErrorMsg('Ukuran file melebihi batas 4 MB.')

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

      const res = await apiFetch('/api/documents', { method: 'POST', body: data })
      const result = await res.json()
      setDocuments([result, ...documents])
      setIsModalOpen(false)
      await showAlert(`Dokumen ${result.docNumber} berhasil diunggah.`, 'Berhasil')
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (d) => {
    const confirmed = await showConfirm(`Hapus dokumen ${d.docNumber} — ${d.title}? File akan dihapus permanen.`, 'Hapus dokumen')
    if (!confirmed) return
    try {
      await apiFetch(`/api/documents/${d.id}`, { method: 'DELETE' })
      setDocuments(documents.filter((x) => x.id !== d.id))
    } catch (err) {
      await showAlert(err.message, 'Gagal')
    }
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="Cari judul, nomor dokumen, atau proyek" />
        <div className="spacer" />
        {canEdit && (
          <button className="btn btn-primary" onClick={handleOpenModal} disabled={!projects.length} title={!projects.length ? 'Belum ada proyek aktif' : undefined}>
            <UploadCloud aria-hidden /> Unggah dokumen
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Dokumen</th>
                <th>Proyek</th>
                <th>Kategori & revisi</th>
                <th>Distribusi</th>
                <th>Diunggah</th>
                <th className="num">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length === 0 ? (
                <EmptyRow colSpan={6} title={documents.length ? 'Tidak ada dokumen yang cocok' : 'Belum ada dokumen'} hint={documents.length ? 'Coba kata kunci lain.' : canEdit ? 'Klik "Unggah dokumen" untuk menambahkan.' : undefined} />
              ) : filteredDocs.map((d) => {
                const targets = parseTargets(d.targets)
                const cat = DOC_CATEGORY[d.category]
                return (
                  <tr key={d.id}>
                    <td style={{ minWidth: 240 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="project-icon" style={{ width: 38, height: 38 }}><FileText size={19} /></div>
                        <div style={{ minWidth: 0 }}>
                          <div className="cell-title">{d.title}</div>
                          <div className="cell-sub">{d.docNumber} · {formatFileSize(d.fileSize)}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--gray-900)' }}>{d.project?.code || '-'}</div>
                      <div className="cell-sub">{d.project?.name}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className={`badge badge-${cat?.[1] ?? 'gray'}`}>{cat?.[0] ?? d.category}</span>
                        <span className="chip">Rev {d.revision}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {targets.includes('SITE') && <span className="badge badge-success">Tim lapangan</span>}
                        {targets.includes('WORKSHOP') && <span className="badge badge-orange">Workshop</span>}
                        {!targets.length && <span className="muted">-</span>}
                      </div>
                    </td>
                    <td className="nowrap">
                      <div>{fmtDate(d.createdAt)}</div>
                      <div className="cell-sub">oleh {d.uploader?.name || '-'}</div>
                    </td>
                    <td>
                      <div className="row-actions">
                        <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="action-btn" title="Unduh / lihat dokumen" aria-label={`Unduh ${d.title}`}>
                          <Download />
                        </a>
                        {canEdit && (
                          <button className="action-btn danger" onClick={() => handleDelete(d)} title="Hapus dokumen" aria-label={`Hapus ${d.title}`}>
                            <Trash2 />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <Modal
          title="Unggah dokumen baru"
          subtitle="Dokumen teknis akan didistribusikan ke tim yang dipilih."
          onClose={() => setIsModalOpen(false)}
          busy={uploading}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)} disabled={uploading}>Batal</button>
              <button type="submit" form="doc-form" className="btn btn-primary" disabled={uploading}>
                {uploading ? 'Mengunggah…' : <><UploadCloud aria-hidden /> Unggah & simpan</>}
              </button>
            </>
          }
        >
          <form id="doc-form" onSubmit={handleUpload} className="form-stack">
            {errorMsg && (
              <div className="alert alert-danger" role="alert"><AlertCircle aria-hidden /> {errorMsg}</div>
            )}

            <div className="form-group">
              <label className="form-label required" htmlFor="doc-project">Proyek terkait</label>
              <select id="doc-project" className="form-select" value={formData.projectId} onChange={(e) => setFormData({ ...formData, projectId: e.target.value })} required>
                <option value="" disabled>Pilih proyek</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
              <div className="form-group">
                <label className="form-label required" htmlFor="doc-number">Nomor dokumen</label>
                <input id="doc-number" required className="form-input" placeholder="DWG-STR-001" value={formData.docNumber} onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="doc-rev">Revisi</label>
                <input id="doc-rev" required maxLength={20} className="form-input" placeholder="A" value={formData.revision} onChange={(e) => setFormData({ ...formData, revision: e.target.value.toUpperCase() })} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required" htmlFor="doc-title">Judul dokumen</label>
              <input id="doc-title" required className="form-input" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="doc-cat">Kategori</label>
                <select id="doc-cat" className="form-select" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                  {Object.entries(DOC_CATEGORY).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <fieldset className="form-group" style={{ border: 'none' }}>
                <legend className="form-label required">Target distribusi</legend>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', minHeight: 42, alignItems: 'center' }}>
                  <label className="check-row">
                    <input type="checkbox" checked={formData.targets.includes('SITE')} onChange={() => handleTargetToggle('SITE')} /> Tim lapangan
                  </label>
                  <label className="check-row">
                    <input type="checkbox" checked={formData.targets.includes('WORKSHOP')} onChange={() => handleTargetToggle('WORKSHOP')} /> Workshop
                  </label>
                </div>
              </fieldset>
            </div>

            <div className="form-group">
              <span className="form-label required">File dokumen</span>
              <div
                role="button"
                tabIndex={0}
                className={`dropzone ${dragging ? 'dragging' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.[0]) setSelectedFile(e.dataTransfer.files[0]) }}
              >
                <input type="file" ref={fileInputRef} hidden onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])} accept=".pdf,.dwg,.doc,.docx,.xls,.xlsx,.zip,.jpg,.jpeg,.png" />
                <File size={30} />
                <strong>{selectedFile ? selectedFile.name : 'Klik untuk memilih file, atau seret ke sini'}</strong>
                <span>{selectedFile ? formatFileSize(selectedFile.size) : 'PDF, DWG, Office, gambar, atau ZIP — maksimal 4 MB'}</span>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
