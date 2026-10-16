'use client';
import { apiFetch } from '@/lib/client-api';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Eye, Check } from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';
import { EmptyRow, Modal, StatusBadge } from '@/components/ui';
import { PRIORITY, fmtDate } from '@/lib/ui-labels';

const emptyItem = () => ({ description: '', unit: '', quantity: '' });

export default function MaterialRequestClient({ requests, projects, user }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState(projects[0]?.id || '');
  const [items, setItems] = useState([emptyItem()]);
  const [priority, setPriority] = useState('NORMAL');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [approving, setApproving] = useState(null);
  const { showAlert, showConfirm } = useDialog();
  const canCreate = ['TOP_MANAGEMENT', 'PJO'].includes(user.role);

  const updateItem = (index, key, value) => setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [key]: value } : it)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validItems = items.filter((i) => i.description.trim() !== '' && Number(i.quantity) > 0);
    if (!selectedProject) {
      await showAlert('Pilih proyek terlebih dahulu.', 'Peringatan');
      return;
    }
    if (validItems.length === 0) {
      await showAlert('Masukkan minimal satu item dengan deskripsi dan kuantitas lebih dari 0.', 'Peringatan');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiFetch('/api/material-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject, priority, notes, items: validItems }),
      });
      setShowForm(false);
      setItems([emptyItem()]);
      setNotes('');
      setPriority('NORMAL');
      router.refresh();
      await showAlert('Material request berhasil diajukan.', 'Berhasil');
    } catch (error) {
      await showAlert(error.message, 'Gagal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const approve = async (req) => {
    if (!(await showConfirm(`Setujui ${req.mrNumber} untuk proyek ${req.project.code}?`, 'Setujui material request'))) return;
    setApproving(req.id);
    try {
      await apiFetch('/api/material-request/' + req.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'APPROVED' }) });
      setDetail(null);
      router.refresh();
    } catch (e) {
      await showAlert(e.message, 'Gagal');
    } finally {
      setApproving(null);
    }
  };

  const openForm = () => {
    setSelectedProject((p) => p || projects[0]?.id || '');
    setShowForm(true);
  };

  return (
    <div className="stack">
      {canCreate && (
        <div className="toolbar">
          <p className="muted" style={{ flex: '1 1 300px', fontSize: 14 }}>
            Ajukan kebutuhan material atau alat dari site. Setelah disetujui, tim logistik membuat purchase order.
          </p>
          <button className="btn btn-primary" onClick={openForm} disabled={!projects.length} title={!projects.length ? 'Belum ada proyek aktif' : undefined}>
            <Plus aria-hidden /> Buat request baru
          </button>
        </div>
      )}

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>No. MR</th>
                <th>Proyek</th>
                <th>Pemohon</th>
                <th>Prioritas</th>
                <th>Status</th>
                <th>Tanggal</th>
                <th className="num">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <EmptyRow colSpan={7} title="Belum ada material request" hint={canCreate ? 'Klik "Buat request baru" untuk mengajukan.' : undefined} />
              ) : requests.map((req) => (
                <tr key={req.id}>
                  <td className="cell-title nowrap">{req.mrNumber}</td>
                  <td>{req.project.code}</td>
                  <td>{req.requester.name}</td>
                  <td><StatusBadge value={req.priority} labels={{ [req.priority]: PRIORITY[req.priority]?.[0] }} tones={{ [req.priority]: PRIORITY[req.priority]?.[1] }} /></td>
                  <td><StatusBadge value={req.status} /></td>
                  <td className="nowrap">{fmtDate(req.createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-sm btn-outline" onClick={() => setDetail(req)}><Eye aria-hidden /> Detail</button>
                      {canCreate && req.status === 'SUBMITTED' && (
                        <button className="btn btn-sm btn-primary" disabled={approving === req.id} onClick={() => approve(req)}><Check aria-hidden /> Setujui</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal
          size="modal-lg"
          title="Buat material request"
          subtitle="Daftar kebutuhan material atau alat untuk proyek."
          onClose={() => setShowForm(false)}
          busy={isSubmitting}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)} disabled={isSubmitting}>Batal</button>
              <button type="submit" form="mr-form" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Mengajukan…' : 'Ajukan material request'}</button>
            </>
          }
        >
          <form id="mr-form" className="form-stack" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="mr-project">Proyek</label>
                <select id="mr-project" className="form-select" value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} required>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="mr-priority">Prioritas</label>
                <select id="mr-priority" className="form-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {Object.entries(PRIORITY).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <span className="form-label required">Daftar material / alat</span>
              <div className="table-wrapper" style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Deskripsi barang</th>
                      <th style={{ width: 130 }}>Satuan</th>
                      <th style={{ width: 130 }}>Kuantitas</th>
                      <th style={{ width: 56 }}><span className="sr-only">Hapus</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index}>
                        <td style={{ padding: '8px 10px', minWidth: 200 }}><input aria-label={`Deskripsi item ${index + 1}`} className="form-input" placeholder="Semen Portland 50 kg" value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} /></td>
                        <td style={{ padding: '8px 10px' }}><input aria-label={`Satuan item ${index + 1}`} className="form-input" placeholder="Sak" value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)} /></td>
                        <td style={{ padding: '8px 10px' }}><input aria-label={`Kuantitas item ${index + 1}`} type="number" min="0" step="any" className="form-input" placeholder="100" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} /></td>
                        <td style={{ padding: '8px 6px' }}>
                          {items.length > 1 && (
                            <button type="button" className="action-btn danger" aria-label={`Hapus item ${index + 1}`} onClick={() => setItems(items.filter((_, i) => i !== index))}>
                              <Trash2 />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 10 }} onClick={() => setItems([...items, emptyItem()])}>
                <Plus aria-hidden /> Tambah baris
              </button>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mr-notes">Catatan untuk tim logistik</label>
              <textarea id="mr-notes" className="form-input" rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal
          title={`Material request ${detail.mrNumber}`}
          subtitle={`${detail.project.code} · diajukan ${detail.requester.name} · ${fmtDate(detail.createdAt)}`}
          onClose={() => setDetail(null)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setDetail(null)}>Tutup</button>
              {canCreate && detail.status === 'SUBMITTED' && (
                <button className="btn btn-primary" disabled={approving === detail.id} onClick={() => approve(detail)}><Check aria-hidden /> Setujui</button>
              )}
            </>
          }
        >
          <div className="form-stack">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge value={detail.status} />
              <StatusBadge value={detail.priority} labels={{ [detail.priority]: 'Prioritas ' + (PRIORITY[detail.priority]?.[0] ?? detail.priority).toLowerCase() }} tones={{ [detail.priority]: PRIORITY[detail.priority]?.[1] }} />
            </div>
            <div className="table-wrapper" style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)' }}>
              <table>
                <thead>
                  <tr><th>Barang</th><th className="num">Jumlah</th><th>Satuan</th></tr>
                </thead>
                <tbody>
                  {detail.items.map((i, idx) => (
                    <tr key={i.id ?? idx}><td>{i.description}</td><td className="num">{Number(i.quantity).toLocaleString('id-ID')}</td><td>{i.unit || '-'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {detail.notes && <p className="muted" style={{ whiteSpace: 'pre-line' }}><strong>Catatan:</strong> {detail.notes}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
