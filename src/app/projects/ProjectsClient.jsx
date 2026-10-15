'use client';
import { apiFetch } from '@/lib/client-api';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Calendar, MapPin, Search, Trash2, Pencil } from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';

export default function ProjectsClient({ initialProjects, user }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null); // project being edited
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showAlert, showConfirm } = useDialog();

  const handleDeleteProject = async (id, code) => {
    const confirmed = await showConfirm(
      `Apakah Anda yakin ingin mengarsipkan proyek ${code}? Data dan histori proyek tetap disimpan.`,
      'Hapus Permanen Proyek'
    );
    if (!confirmed) return;

    try {
      const res = await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Gagal menghapus proyek');
      }
      setProjects(prev => prev.filter(p => p.id !== id));
      await showAlert('Proyek berhasil diarsipkan.', 'Sukses');
      router.refresh();
    } catch (error) {
      await showAlert(error.message, 'Error');
    }
  };
  
  const [formData, setFormData] = useState({
    code: '', name: '', client: '', location: '', contractValue: '', startDate: '', endDate: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Gagal menambahkan proyek');
      }
      const newProject = await res.json();
      setProjects([newProject, ...projects]);
      setShowModal(false);
      setFormData({ code: '', name: '', client: '', location: '', contractValue: '', startDate: '', endDate: '' });
      router.refresh();
      await showAlert('Proyek berhasil ditambahkan!', 'Sukses');
    } catch (error) {
      await showAlert(error.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditProject = (p) => {
    setEditingProject({
      id: p.id,
      code: p.code,
      name: p.name,
      client: p.client || '',
      location: p.location || '',
      contractValue: p.contractValue || '',
      startDate: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '',
      endDate: p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : '',
      status: p.status || 'ACTIVE',
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProject),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Gagal memperbarui proyek');
      }
      const updated = await res.json();
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
      setEditingProject(null);
      router.refresh();
      await showAlert('Proyek berhasil diperbarui!', 'Sukses');
    } catch (error) {
      await showAlert(error.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 300 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--gray-400)' }} />
          <input type="text" className="form-input" placeholder="Cari proyek..." style={{ paddingLeft: 36 }} />
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} className="inline-block mr-2" />
          Tambah Proyek Baru
        </button>
      </div>

      {/* Projects Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        {projects.map(p => (
          <div key={p.id} className="card" style={{ transition: 'all 0.2s', cursor: 'pointer' }}>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ 
                    width: 40, height: 40, borderRadius: 8, background: 'var(--navy-50)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy-600)'
                  }}>
                    <Building2 size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{p.code}</div>
                    <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{p.client}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge ${p.status === 'ACTIVE' ? 'badge-success' : 'badge-gray'}`}>
                    {p.status}
                  </span>
                  {user?.role === 'TOP_MANAGEMENT' && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditProject(p); }}
                        style={{
                          background: 'none', border: 'none', padding: 6,
                          borderRadius: 6, color: 'var(--navy-600)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: 'var(--navy-50)'
                        }}
                        title="Edit Proyek"
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--navy-100)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--navy-50)'}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id, p.code); }}
                        style={{
                          background: 'none', border: 'none', padding: 6,
                          borderRadius: 6, color: 'var(--red-500)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: 'var(--red-50)'
                        }}
                        title="Hapus Proyek"
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--red-100)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--red-50)'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              <div style={{ fontWeight: 600, color: 'var(--navy-700)', marginBottom: 16, lineHeight: 1.4 }}>
                {p.name}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--gray-600)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={14} /> {p.location}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={14} /> {new Date(p.startDate).toLocaleDateString('id-ID')} - {new Date(p.endDate).toLocaleDateString('id-ID')}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Project Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title">Tambah Proyek Baru</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit} className="form-grid" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                <div className="form-group">
                  <label className="form-label required">Kode Proyek</label>
                  <input type="text" className="form-input" required placeholder="Contoh: PRJ-002"
                    value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                </div>

                <div className="form-group">
                  <label className="form-label required">Nama Proyek</label>
                  <input type="text" className="form-input" required
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>

                <div className="form-group">
                  <label className="form-label required">Klien / Pemilik</label>
                  <input type="text" className="form-input" required
                    value={formData.client} onChange={e => setFormData({...formData, client: e.target.value})} />
                </div>

                <div className="form-group">
                  <label className="form-label required">Lokasi</label>
                  <input type="text" className="form-input" required
                    value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                </div>

                <div className="form-group">
                  <label className="form-label required">Nilai Kontrak (Rp)</label>
                  <input type="number" className="form-input" required
                    value={formData.contractValue} onChange={e => setFormData({...formData, contractValue: e.target.value})} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label required">Tanggal Mulai</label>
                    <input type="date" className="form-input" required
                      value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Tanggal Selesai</label>
                    <input type="date" className="form-input" required
                      value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Proyek'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Edit Project Modal */}
      {editingProject && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title">Edit Proyek — {editingProject.code}</div>
              <button onClick={() => setEditingProject(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <div className="card-body">
              <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label required">Kode Proyek</label>
                    <input type="text" className="form-input" required
                      value={editingProject.code}
                      onChange={e => setEditingProject({...editingProject, code: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-input form-select"
                      value={editingProject.status}
                      onChange={e => setEditingProject({...editingProject, status: e.target.value})}>
                      <option value="ACTIVE">Active</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="ON_HOLD">On Hold</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label required">Nama Proyek</label>
                  <input type="text" className="form-input" required
                    value={editingProject.name}
                    onChange={e => setEditingProject({...editingProject, name: e.target.value})} />
                </div>

                <div className="form-group">
                  <label className="form-label required">Klien / Pemilik</label>
                  <input type="text" className="form-input" required
                    value={editingProject.client}
                    onChange={e => setEditingProject({...editingProject, client: e.target.value})} />
                </div>

                <div className="form-group">
                  <label className="form-label required">Lokasi</label>
                  <input type="text" className="form-input" required
                    value={editingProject.location}
                    onChange={e => setEditingProject({...editingProject, location: e.target.value})} />
                </div>

                <div className="form-group">
                  <label className="form-label required">Nilai Kontrak (Rp)</label>
                  <input type="number" className="form-input" required
                    value={editingProject.contractValue}
                    onChange={e => setEditingProject({...editingProject, contractValue: e.target.value})} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label required">Tanggal Mulai</label>
                    <input type="date" className="form-input" required
                      value={editingProject.startDate}
                      onChange={e => setEditingProject({...editingProject, startDate: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Tanggal Selesai</label>
                    <input type="date" className="form-input" required
                      value={editingProject.endDate}
                      onChange={e => setEditingProject({...editingProject, endDate: e.target.value})} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setEditingProject(null)}>Batal</button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
