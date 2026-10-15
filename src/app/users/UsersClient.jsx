'use client'
import { apiFetch } from '@/lib/client-api';

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Users, UserPlus, Shield, XCircle, 
  Search, Edit, Save, Key, Mail, AlertCircle
} from 'lucide-react'

export default function UsersClient({ initialUsers }) {
  const [users, setUsers] = useState(initialUsers)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  
  // Form State
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'PJO', isActive: true
  })

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  )

  const handleOpenModal = (user = null) => {
    setErrorMsg('')
    if (user) {
      setEditingId(user.id)
      setFormData({
        name: user.name,
        email: user.email,
        password: '', // Blank for edit (only fill to change)
        role: user.role,
        isActive: user.isActive
      })
    } else {
      setEditingId(null)
      setFormData({ name: '', email: '', password: '', role: 'PJO', isActive: true })
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      if (!editingId && !formData.password) {
        throw new Error('Kata sandi wajib diisi untuk pengguna baru')
      }

      const method = editingId ? 'PUT' : 'POST'
      const url = editingId ? `/api/users/${editingId}` : '/api/users'

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan')

      if (editingId) {
        setUsers(users.map(u => u.id === editingId ? data : u))
      } else {
        setUsers([...users, data])
      }

      setIsModalOpen(false)
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
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
            placeholder="Pencarian Pengguna..." 
            className="form-input"
            style={{ paddingLeft: '44px', borderRadius: '12px', background: 'white', height: '44px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button 
          className="btn btn-primary" 
          style={{ height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => handleOpenModal()}
        >
          <UserPlus size={18} /> 
          <span>Tambah Pengguna</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ boxShadow: 'var(--shadow-md)', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table>
            <thead style={{ background: 'var(--gray-50)' }}>
              <tr>
                <th>Pengguna</th>
                <th>Hak Akses</th>
                <th>Status</th>
                <th>Bergabung Pada</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
                    Tidak ada pengguna ditemukan.
                  </td>
                </tr>
              ) : filteredUsers.map((u) => (
                <tr key={u.id} style={{ transition: 'background 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '40px', height: '40px', borderRadius: '12px', 
                        background: 'linear-gradient(135deg, var(--navy-600), var(--orange-500))', 
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        fontWeight: 700, fontSize: '13px', flexShrink: 0
                      }}>
                        {getInitials(u.name)}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, color: 'var(--gray-900)', fontSize: '14px' }}>{u.name}</p>
                        <p style={{ fontSize: '12.5px', color: 'var(--gray-500)', marginTop: '2px', fontWeight: 500 }}>{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '20px', fontWeight: 600, fontSize: '11.5px', letterSpacing: '0.5px' }}>
                      <Shield size={12} /> {u.role}
                    </span>
                  </td>
                  <td>
                    {u.isActive ? (
                      <span className="badge badge-success" style={{ fontWeight: 600, fontSize: '12px' }}>Aktif</span>
                    ) : (
                      <span className="badge badge-danger" style={{ fontWeight: 600, fontSize: '12px' }}>Non-Aktif</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--gray-600)', fontSize: '13.5px', fontWeight: 500 }}>
                    {new Date(u.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="btn-ghost" 
                      style={{ padding: '8px', borderRadius: '8px', color: 'var(--navy-600)' }}
                      onClick={() => handleOpenModal(u)}
                      title="Edit Pengguna"
                    >
                      <Edit size={18} />
                    </button>
                  </td>
                </tr>
              ))}
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
                background: 'white', borderRadius: '20px', width: '100%', maxWidth: '500px', 
                boxShadow: 'var(--shadow-xl)', overflow: 'hidden'
              }}
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            >
              <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy-900)' }}>
                    {editingId ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '4px' }}>
                    {editingId ? 'Perbarui informasi dan hak akses pengguna.' : 'Buat kredensial akses baru untuk staf.'}
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: '4px' }}>
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {errorMsg && (
                  <div style={{ padding: '12px 16px', background: 'var(--red-50)', color: 'var(--red-600)', borderRadius: '10px', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} /> {errorMsg}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label required">Nama Lengkap</label>
                  <div style={{ position: 'relative' }}>
                    <Users size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                    <input 
                      type="text" required
                      className="form-input" 
                      style={{ paddingLeft: '40px', height: '44px', borderRadius: '10px' }}
                      value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label required">Email</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                    <input 
                      type="email" required
                      className="form-input" 
                      style={{ paddingLeft: '40px', height: '44px', borderRadius: '10px' }}
                      value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{editingId ? 'Kata Sandi Baru' : 'Kata Sandi'}</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                    <input 
                      type="password" 
                      className="form-input" 
                      placeholder={editingId ? 'Abaikan jika tidak diubah' : 'Ketik kata sandi...'}
                      style={{ paddingLeft: '40px', height: '44px', borderRadius: '10px' }}
                      value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                      required={!editingId}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div className="form-group">
                    <label className="form-label required">Hak Akses</label>
                    <select 
                      className="form-select" 
                      style={{ height: '44px', borderRadius: '10px', fontWeight: 600 }}
                      value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}
                    >
                      <option value="TOP_MANAGEMENT">Top Management</option>
                      <option value="HRD">HRD</option>
                      <option value="FINANCE">Finance</option>
                      <option value="PJO">PJO</option>
                      <option value="LOGISTIK">Logistik</option>
                      <option value="ENGINEERING">Engineering</option>
                      <option value="WORKSHOP">Workshop</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label required">Status Akun</label>
                    <select 
                      className="form-select" 
                      style={{ height: '44px', borderRadius: '10px', fontWeight: 600, color: formData.isActive ? 'var(--green-700)' : 'var(--red-700)' }}
                      value={formData.isActive.toString()} onChange={e => setFormData({...formData, isActive: e.target.value === 'true'})}
                    >
                      <option value="true">Aktif</option>
                      <option value="false">Non-Aktif</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', paddingTop: '24px', borderTop: '1px solid var(--gray-100)' }}>
                  <button type="button" className="btn btn-ghost" style={{ padding: '10px 24px', borderRadius: '10px', fontWeight: 600 }} onClick={() => setIsModalOpen(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: '10px', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'center' }} disabled={loading}>
                    <Save size={18} /> {loading ? 'Menyimpan...' : 'Simpan Data'}
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
