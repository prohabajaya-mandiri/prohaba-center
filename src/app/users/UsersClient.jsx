'use client'
import { apiFetch } from '@/lib/client-api';

import { useState } from 'react'
import { UserPlus, Pencil, AlertCircle } from 'lucide-react'
import { EmptyRow, Modal, SearchField } from '@/components/ui'
import { ROLE_LABELS, initials, fmtDate } from '@/lib/ui-labels'

const EMPTY = { name: '', email: '', password: '', role: 'PJO', isActive: true, siteProjectId: '' }

export default function UsersClient({ initialUsers, projects = [] }) {
  const [users, setUsers] = useState(initialUsers)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(EMPTY)

  const q = search.trim().toLowerCase()
  const filteredUsers = users.filter((u) =>
    !q || [u.name, u.email, u.role, ROLE_LABELS[u.role]].some((v) => (v || '').toLowerCase().includes(q)),
  )

  const handleOpenModal = (user = null) => {
    setErrorMsg('')
    if (user) {
      setEditingId(user.id)
      setFormData({ name: user.name, email: user.email, password: '', role: user.role, isActive: user.isActive, siteProjectId: user.siteProjectId ?? '' })
    } else {
      setEditingId(null)
      setFormData(EMPTY)
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    try {
      if (!editingId && !formData.password) throw new Error('Kata sandi wajib diisi untuk pengguna baru.')
      const res = await apiFetch(editingId ? `/api/users/${editingId}` : '/api/users', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, siteProjectId: formData.role === 'FUELMAN' ? formData.siteProjectId : null }),
      })
      const data = await res.json()
      setUsers(editingId ? users.map((u) => (u.id === editingId ? data : u)) : [...users, data])
      setIsModalOpen(false)
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  const set = (key) => (e) => setFormData({ ...formData, [key]: e.target.value })

  return (
    <div className="stack">
      <div className="toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="Cari nama, email, atau peran" />
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <UserPlus aria-hidden /> Tambah pengguna
        </button>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Peran / hak akses</th>
                <th>Status</th>
                <th>Terdaftar</th>
                <th className="num">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <EmptyRow colSpan={5} title="Tidak ada pengguna ditemukan" />
              ) : filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="user-avatar" aria-hidden>{initials(u.name)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="cell-title">{u.name}</div>
                        <div className="cell-sub">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-navy">{ROLE_LABELS[u.role] ?? u.role}</span>
                    {u.role === 'FUELMAN' && <div className="cell-sub">Site {projects.find((p) => p.id === u.siteProjectId)?.code ?? '-'}</div>}
                  </td>
                  <td>{u.isActive ? <span className="badge badge-success">Aktif</span> : <span className="badge badge-gray">Nonaktif</span>}</td>
                  <td className="nowrap">{fmtDate(u.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => handleOpenModal(u)}><Pencil aria-hidden /> Ubah</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <Modal
          title={editingId ? 'Ubah pengguna' : 'Tambah pengguna baru'}
          subtitle={editingId ? 'Perbarui data dan hak akses pengguna.' : 'Buat akun akses baru untuk staf.'}
          onClose={() => setIsModalOpen(false)}
          busy={loading}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)} disabled={loading}>Batal</button>
              <button type="submit" form="user-form" className="btn btn-primary" disabled={loading}>{loading ? 'Menyimpan…' : 'Simpan'}</button>
            </>
          }
        >
          <form id="user-form" onSubmit={handleSave} className="form-stack">
            {errorMsg && <div className="alert alert-danger" role="alert"><AlertCircle aria-hidden /> {errorMsg}</div>}
            <div className="form-group">
              <label className="form-label required" htmlFor="u-name">Nama lengkap</label>
              <input id="u-name" required className="form-input" value={formData.name} onChange={set('name')} />
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="u-email">Email</label>
              <input id="u-email" type="email" required className="form-input" autoComplete="off" value={formData.email} onChange={set('email')} />
            </div>
            <div className="form-group">
              <label className={`form-label ${editingId ? '' : 'required'}`} htmlFor="u-pass">{editingId ? 'Kata sandi baru' : 'Kata sandi'}</label>
              <input id="u-pass" type="password" className="form-input" autoComplete="new-password" placeholder={editingId ? 'Kosongkan jika tidak diubah' : ''} value={formData.password} onChange={set('password')} required={!editingId} />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="u-role">Peran / hak akses</label>
                <select id="u-role" className="form-select" value={formData.role} onChange={set('role')}>
                  {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="u-active">Status akun</label>
                <select id="u-active" className="form-select" value={String(formData.isActive)} onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}>
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </select>
              </div>
            </div>
            {formData.role === 'FUELMAN' && (
              <div className="form-group">
                <label className="form-label required" htmlFor="u-site">Site tempat bertugas</label>
                <select id="u-site" className="form-select" required value={formData.siteProjectId} onChange={set('siteProjectId')}>
                  <option value="">Pilih site</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
                </select>
                <p className="form-hint">Petugas hanya mencatat BBM untuk site ini lewat web BBM di HP.</p>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  )
}
