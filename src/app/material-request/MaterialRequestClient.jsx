'use client';
import { apiFetch } from '@/lib/client-api';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Plus, CheckCircle, Clock, XCircle, FileText } from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';

export default function MaterialRequestClient({ requests, projects, user }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('list');
  const [selectedProject, setSelectedProject] = useState(projects[0]?.id || '');
  const [items, setItems] = useState([{ description: '', unit: '', quantity: '' }]);
  const [priority, setPriority] = useState('NORMAL');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { showAlert } = useDialog();

  const handleSubmit = async () => {
    // Validate items
    const validItems = items.filter(i => i.description.trim() !== '' && i.quantity > 0);
    if (validItems.length === 0) {
      await showAlert('Minimal masukkan 1 item yang valid.', 'Peringatan');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        projectId: selectedProject,
        priority,
        notes,
        items: validItems,

      };
      const res = await apiFetch('/api/material-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Gagal membuat MR');
      }
      await showAlert('Material Request berhasil diajukan!', 'Sukses');
      setActiveTab('list');
      setItems([{ description: '', unit: '', quantity: '' }]);
      setNotes('');
      router.refresh();
    } catch (error) {
      await showAlert(error.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT': return <span className="badge badge-gray">Draft</span>;
      case 'SUBMITTED': return <span className="badge badge-warning"><Clock size={12} className="mr-1 inline" /> Menunggu Approval</span>;
      case 'APPROVED': return <span className="badge badge-success"><CheckCircle size={12} className="mr-1 inline" /> Disetujui</span>;
      case 'PO_CREATED': return <span className="badge badge-info"><Package size={12} className="mr-1 inline" /> PO Dibuat</span>;
      case 'REJECTED': return <span className="badge badge-danger"><XCircle size={12} className="mr-1 inline" /> Ditolak</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'HIGH':
      case 'URGENT': return <span className="text-red-600 font-bold text-xs">{priority}</span>;
      default: return <span className="text-gray-500 font-medium text-xs">{priority}</span>;
    }
  };

  return (
    <>
      <div className="tabs">
        <button className={`tab ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
          <FileText size={16} className="inline-block mr-2" />
          Daftar Material Request
        </button>
        {['TOP_MANAGEMENT','PJO'].includes(user.role) && (
          <button className={`tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>
            <Plus size={16} className="inline-block mr-2" />
            Buat Request Baru
          </button>
        )}
      </div>

      {activeTab === 'list' && (
        <div className="card">
          <div className="card-body p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>No. MR</th>
                  <th>Proyek</th>
                  <th>Pemohon</th>
                  <th>Prioritas</th>
                  <th>Status</th>
                  <th>Tanggal</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-500">Belum ada data Material Request.</td></tr>
                ) : (
                  requests.map(req => (
                    <tr key={req.id}>
                      <td style={{ fontWeight: 600, color: 'var(--navy-700)' }}>{req.mrNumber}</td>
                      <td>{req.project.code}</td>
                      <td>{req.requester.name}</td>
                      <td>{getPriorityBadge(req.priority)}</td>
                      <td>{getStatusBadge(req.status)}</td>
                      <td style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{new Date(req.createdAt).toLocaleDateString('id-ID')}</td>
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={()=>showAlert(req.items.map(i=>i.description+' — '+i.quantity+' '+i.unit).join('\n'),'Detail MR')}>Detail</button>
                        {['TOP_MANAGEMENT','PJO'].includes(user.role) && req.status === 'SUBMITTED' && (
                          <button className="btn btn-sm btn-primary ml-2" onClick={async()=>{try{await apiFetch('/api/material-request/'+req.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'APPROVED'})});router.refresh();}catch(e){await showAlert(e.message,'Gagal');}}}>Setujui</button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Form Material Request Baru</div>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required">Proyek</label>
                <select className="form-input form-select" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required">Prioritas</label>
                <select className="form-input form-select" value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="NORMAL">NORMAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 20, marginBottom: 20 }}>
              <label className="form-label required">Daftar Item Material/Alat</label>
              <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table className="table">
                  <thead style={{ background: 'var(--gray-50)' }}>
                    <tr>
                      <th>Deskripsi Barang</th>
                      <th style={{ width: 120 }}>Satuan</th>
                      <th style={{ width: 120 }}>Kuantitas</th>
                      <th style={{ width: 50 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index}>
                        <td><input type="text" className="form-input" placeholder="Semen Portland 50kg" value={item.description} onChange={(e) => { const newItems = [...items]; newItems[index].description = e.target.value; setItems(newItems); }} /></td>
                        <td><input type="text" className="form-input" placeholder="Sak" value={item.unit} onChange={(e) => { const newItems = [...items]; newItems[index].unit = e.target.value; setItems(newItems); }} /></td>
                        <td><input type="number" className="form-input" placeholder="100" value={item.quantity} onChange={(e) => { const newItems = [...items]; newItems[index].quantity = e.target.value; setItems(newItems); }} /></td>
                        <td>
                          {items.length > 1 && (
                            <button className="btn btn-sm btn-outline" style={{ color: 'var(--red-600)', borderColor: 'var(--red-200)' }} onClick={() => setItems(items.filter((_, i) => i !== index))}>
                              <XCircle size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn btn-sm btn-outline" style={{ marginTop: 10 }} onClick={() => setItems([...items, { description: '', unit: '', quantity: '' }])}>
                <Plus size={14} className="inline-block mr-2" /> Tambah Item
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Catatan / Keterangan</label>
              <textarea className="form-input" rows="3" placeholder="Catatan tambahan untuk tim logistik..." value={notes} onChange={e => setNotes(e.target.value)}></textarea>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button className="btn btn-outline" onClick={() => setActiveTab('list')}>Batal</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Mengajukan...' : 'Ajukan MR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
