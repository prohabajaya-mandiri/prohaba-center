'use client';
import { apiFetch } from '@/lib/client-api';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Calendar, MapPin, Trash2, Pencil, Wallet, Link2, AlertTriangle } from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';
import { Modal, SearchField, StatusBadge } from '@/components/ui';
import { idr, fmtDate } from '@/lib/ui-labels';

const EMPTY = { code: '', name: '', client: '', location: '', contractValue: '', startDate: '', endDate: '', status: 'ACTIVE', hseSiteId: '' };
const toDateInput = (v) => (v ? new Date(v).toISOString().split('T')[0] : '');

export default function ProjectsClient({ initialProjects, user, sites, sitesError }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null); // null = tertutup; { id? , ...field }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showAlert, showConfirm } = useDialog();

  const canCreate = ['TOP_MANAGEMENT', 'PJO'].includes(user?.role);
  const canManage = user?.role === 'TOP_MANAGEMENT';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      [p.code, p.name, p.client, p.location].some((v) => (v || '').toLowerCase().includes(q)),
    );
  }, [projects, search]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const openCreate = () => setForm({ ...EMPTY });
  const openEdit = (p) => setForm({
    id: p.id,
    code: p.code,
    name: p.name,
    client: p.client || '',
    location: p.location || '',
    contractValue: p.contractValue ?? '',
    startDate: toDateInput(p.startDate),
    endDate: toDateInput(p.endDate),
    status: p.status || 'ACTIVE',
    hseSiteId: p.hseSiteId || '',
    hseSiteOriginal: p.hseSiteId || '',
  });

  const handleArchive = async (p) => {
    const confirmed = await showConfirm(
      `Arsipkan proyek ${p.code} — ${p.name}? Proyek tidak tampil lagi di daftar, tetapi data dan riwayatnya tetap disimpan.`,
      'Arsipkan proyek',
    );
    if (!confirmed) return;
    try {
      await apiFetch(`/api/projects/${p.id}`, { method: 'DELETE' });
      setProjects((prev) => prev.filter((x) => x.id !== p.id));
      router.refresh();
      await showAlert('Proyek berhasil diarsipkan.', 'Berhasil');
    } catch (error) {
      await showAlert(error.message, 'Gagal');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      await showAlert('Tanggal selesai tidak boleh sebelum tanggal mulai.', 'Periksa kembali');
      return;
    }
    setIsSubmitting(true);
    try {
      const editing = Boolean(form.id);
      const { id, hseSiteOriginal, ...body } = form;
      if (!editing) delete body.status;
      // Tautan site hanya dikirim bila berubah, sehingga data lain tetap bisa diubah saat E-HSE tidak terhubung.
      if (!body.hseSiteId || body.hseSiteId === hseSiteOriginal) delete body.hseSiteId;
      const res = await apiFetch(editing ? `/api/projects/${id}` : '/api/projects', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const saved = await res.json();
      setProjects((prev) => (editing ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]));
      setForm(null);
      router.refresh();
      await showAlert(editing ? 'Perubahan proyek tersimpan.' : 'Proyek baru berhasil ditambahkan.', 'Berhasil');
    } catch (error) {
      await showAlert(error.message, 'Gagal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="stack">
      {sitesError && (
        <p role="alert" className="alert alert-warning">
          <AlertTriangle aria-hidden /> <span>Daftar site E-HSE tidak dapat dimuat: {sitesError}</span>
        </p>
      )}
      <div className="toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="Cari kode, nama, klien, atau lokasi" />
        <div className="spacer" />
        {canCreate && (
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus aria-hidden /> Tambah proyek
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card empty-state">
          <Building2 aria-hidden />
          <h3>{projects.length ? 'Tidak ada proyek yang cocok' : 'Belum ada proyek'}</h3>
          <p>{projects.length ? 'Coba kata kunci lain.' : 'Proyek yang ditambahkan akan tampil di sini.'}</p>
        </div>
      ) : (
        <div className="project-grid">
          {filtered.map((p) => (
            <article key={p.id} className="card project-card">
              <div className="project-card-header">
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                  <div className="project-icon"><Building2 size={20} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div className="project-code">{p.code}</div>
                    <div className="project-client truncate">{p.client || 'Klien belum diisi'}</div>
                  </div>
                </div>
                <StatusBadge value={p.status} />
              </div>

              <div className="project-name">{p.name}</div>

              <div className="project-meta">
                <div className="project-meta-item"><MapPin size={15} /> {p.location || '-'}</div>
                <div className="project-meta-item">
                  <Link2 size={15} />
                  {p.hseSiteCode ? `Site E-HSE ${p.hseSiteCode}${p.hseSiteName ? ` — ${p.hseSiteName}` : ''}` : <span className="text-danger">Belum ditautkan ke site E-HSE</span>}
                </div>
                <div className="project-meta-item"><Calendar size={15} /> {fmtDate(p.startDate)} – {fmtDate(p.endDate)}</div>
                <div className="project-meta-item"><Wallet size={15} /> Nilai kontrak {idr(p.contractValue)}</div>
              </div>

              {canManage && (
                <div className="row-actions" style={{ marginTop: 14, justifyContent: 'flex-start' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>
                    <Pencil aria-hidden /> Ubah
                  </button>
                  <button className="btn btn-danger-outline btn-sm" onClick={() => handleArchive(p)}>
                    <Trash2 aria-hidden /> Arsipkan
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {form && (
        <Modal
          title={form.id ? `Ubah proyek — ${form.code}` : 'Tambah proyek baru'}
          subtitle={form.id ? 'Perubahan nilai kontrak akan menghitung ulang bobot item BOQ.' : 'Lengkapi data kontrak proyek.'}
          onClose={() => setForm(null)}
          busy={isSubmitting}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setForm(null)} disabled={isSubmitting}>Batal</button>
              <button type="submit" form="project-form" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Menyimpan…' : form.id ? 'Simpan perubahan' : 'Simpan proyek'}
              </button>
            </>
          }
        >
          <form id="project-form" onSubmit={handleSubmit} className="form-stack">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="pj-code">Kode proyek</label>
                <input id="pj-code" className="form-input" required placeholder="Contoh: PRJ-002" value={form.code} onChange={set('code')} />
              </div>
              {form.id ? (
                <div className="form-group">
                  <label className="form-label" htmlFor="pj-status">Status</label>
                  <select id="pj-status" className="form-select" value={form.status} onChange={set('status')}>
                    <option value="ACTIVE">Aktif</option>
                    <option value="ON_HOLD">Ditunda</option>
                    <option value="COMPLETED">Selesai</option>
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label required" htmlFor="pj-value">Nilai kontrak (Rp)</label>
                  <input id="pj-value" type="number" min="0" className="form-input" required value={form.contractValue} onChange={set('contractValue')} />
                </div>
              )}
            </div>
            {sites && (
              <div className="form-group">
                <label className="form-label required" htmlFor="pj-site">Site E-HSE</label>
                <select id="pj-site" className="form-select" required={!form.id || !form.hseSiteId} value={form.hseSiteId} onChange={set('hseSiteId')}>
                  <option value="">Pilih site</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                </select>
                <span className="form-hint">Karyawan yang ditempatkan di site ini (E-HSE) otomatis ditugaskan ke proyek bila site hanya punya satu proyek aktif.</span>
              </div>
            )}
            <div className="form-group">
              <label className="form-label required" htmlFor="pj-name">Nama proyek</label>
              <input id="pj-name" className="form-input" required value={form.name} onChange={set('name')} />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="pj-client">Klien / pemilik</label>
                <input id="pj-client" className="form-input" required value={form.client} onChange={set('client')} />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="pj-loc">Lokasi</label>
                <input id="pj-loc" className="form-input" required value={form.location} onChange={set('location')} />
              </div>
            </div>
            {form.id && (
              <div className="form-group">
                <label className="form-label required" htmlFor="pj-value">Nilai kontrak (Rp)</label>
                <input id="pj-value" type="number" min="0" className="form-input" required value={form.contractValue} onChange={set('contractValue')} />
              </div>
            )}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="pj-start">Tanggal mulai</label>
                <input id="pj-start" type="date" className="form-input" required value={form.startDate} onChange={set('startDate')} />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="pj-end">Tanggal selesai</label>
                <input id="pj-end" type="date" className="form-input" required min={form.startDate || undefined} value={form.endDate} onChange={set('endDate')} />
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
