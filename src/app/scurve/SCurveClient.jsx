'use client';
import { apiFetch, businessToday } from '@/lib/client-api';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/components/DialogProvider';
import { Modal } from '@/components/ui';
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart,
} from 'recharts';
import {
  Plus, Upload, FileSpreadsheet, Calendar,
  CheckCircle, Save, RefreshCw, Edit, Trash2, Loader2, Info,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtIDR = (v) => {
  if (!v) return '-';
  if (v >= 1e9) return `Rp ${(v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`;
  if (v >= 1e6) return `Rp ${(v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  return `Rp ${Number(v).toLocaleString('id-ID')}`;
};

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
const fmtMonth = (m) => {
  if (!m) return '-';
  const [y, mo] = m.split('-');
  return `${MONTHS_ID[parseInt(mo, 10) - 1]} ${y}`;
};
const monthIndex = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return y * 12 + mo - 1;
};
const pct = (v) => `${Number(v).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const levelIndent = { 1: 0, 2: 16, 3: 32, 4: 48 };
const levelStyle = {
  1: { fontWeight: 600, color: 'var(--brand-800)' },
  2: { fontWeight: 600, color: 'var(--gray-800)' },
  3: { fontWeight: 500, color: 'var(--gray-700)' },
  4: { fontWeight: 400, color: 'var(--gray-600)' },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const plan = payload.find((p) => p.dataKey === 'planned')?.value;
  const actual = payload.find((p) => p.dataKey === 'actual')?.value;
  return (
    <div className="chart-tooltip">
      <div style={{ fontWeight: 600, color: 'var(--gray-900)', marginBottom: 6 }}>{fmtMonth(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span className="legend-dot" style={{ background: p.color }} />
          <span style={{ color: 'var(--gray-600)' }}>{p.name}:</span>
          <strong style={{ color: 'var(--gray-900)' }}>{pct(p.value)}</strong>
        </div>
      ))}
      {plan != null && actual != null && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--gray-100)', fontWeight: 600, color: actual < plan ? 'var(--red-600)' : 'var(--green-600)' }}>
          {actual < plan ? 'Terlambat ' : 'Lebih cepat '}{pct(Math.abs(actual - plan))}
        </div>
      )}
    </div>
  );
};

function NeedBoq({ onGo }) {
  return (
    <div className="empty-state">
      <FileSpreadsheet aria-hidden />
      <h3>Belum ada data BOQ</h3>
      <p>Unggah file BOQ (.xlsx) terlebih dahulu di tab &quot;Upload BOQ&quot;.</p>
      <button className="btn btn-primary" onClick={onGo}><Upload aria-hidden /> Upload BOQ</button>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function SCurveClient({ tab: activeTab = 'scurve', projects, user }) {
  const router = useRouter();
  // Sub-menu dipilih lewat URL agar sinkron dengan sidebar.
  const setActiveTab = (key) => router.push(`/scurve?tab=${key}`, { scroll: false });
  const readOnly = !['TOP_MANAGEMENT', 'ENGINEERING', 'PJO'].includes(user?.role);
  const [selectedProjectId, setSelectedProjectId] = useState(projects?.[0]?.id || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState(null);
  const [scheduleEdits, setScheduleEdits] = useState({});
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [actualEdits, setActualEdits] = useState({});
  const [savingActual, setSavingActual] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => businessToday().slice(0, 7));
  const [itemForm, setItemForm] = useState(null); // { id?, code, description, totalPrice }
  const [savingItem, setSavingItem] = useState(false);
  const { showConfirm, showAlert } = useDialog();
  const fileInputRef = useRef();

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);

  const loadData = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/scurve?projectId=${selectedProjectId}`);
      const json = await res.json();
      setData(json);
      const edits = {};
      json.boqItems?.forEach((item) => {
        if (item.isLeaf) edits[item.id] = { startMonth: item.startMonth || '', endMonth: item.endMonth || '' };
      });
      setScheduleEdits(edits);
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => { const timer = setTimeout(loadData, 0); return () => clearTimeout(timer); }, [loadData]);

  const items = useMemo(() => data?.boqItems ?? [], [data]);
  const leaves = useMemo(() => items.filter((i) => i.isLeaf), [items]);
  const hasBoq = items.length > 0;
  const scheduledCount = leaves.filter((i) => i.startMonth && i.endMonth).length;
  const scheduledPct = leaves.length ? Math.round((scheduledCount / leaves.length) * 100) : 0;
  const lastPlan = data?.scurveData?.length ? data.scurveData[data.scurveData.length - 1].planned : null;

  // ─── Laporan per kelompok: rencana s.d. bulan ini vs realisasi ──────────
  const report = useMemo(() => {
    const now = monthIndex(businessToday().slice(0, 7));
    const planShare = (leaf) => {
      if (!leaf.startMonth || !leaf.endMonth) return 0;
      const s = monthIndex(leaf.startMonth), e = monthIndex(leaf.endMonth);
      const n = e - s + 1;
      if (n <= 0) return 0;
      return Math.min(1, Math.max(0, (now - s + 1) / n));
    };
    const doneShare = (leaf) => Math.min(1, (leaf.actuals ?? []).reduce((s, a) => s + (a.progressPct || 0), 0) / 100);
    return items
      .filter((i) => i.level <= 2)
      .map((group) => {
        const prefix = group.code.toUpperCase() + '.';
        const members = group.isLeaf ? [group] : leaves.filter((l) => l.code.toUpperCase().startsWith(prefix));
        const weight = members.reduce((s, l) => s + (l.weight || 0), 0);
        if (!weight) return null;
        const planned = (members.reduce((s, l) => s + (l.weight || 0) * planShare(l), 0) / weight) * 100;
        const actual = (members.reduce((s, l) => s + (l.weight || 0) * doneShare(l), 0) / weight) * 100;
        const scheduled = members.some((l) => l.startMonth && l.endMonth);
        return { group, weight, planned, actual, scheduled };
      })
      .filter(Boolean);
  }, [items, leaves]);

  // ─── Item BOQ ────────────────────────────────────────────────────────────
  const handleDeleteBoqItem = async (item) => {
    const ok = await showConfirm(`Hapus item ${item.code} — ${item.description}? Item yang sudah memiliki realisasi tidak dapat dihapus.`, 'Hapus item BOQ');
    if (!ok) return;
    try {
      await apiFetch(`/api/boq/item/${item.id}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: `Item ${item.code} dihapus.` });
      await loadData();
    } catch (e) {
      await showAlert(e.message, 'Gagal');
    }
  };

  const saveItem = async (e) => {
    e.preventDefault();
    setSavingItem(true);
    try {
      const body = { code: itemForm.code, description: itemForm.description, totalPrice: parseFloat(itemForm.totalPrice) || 0 };
      await apiFetch(itemForm.id ? `/api/boq/item/${itemForm.id}` : '/api/boq/item', {
        method: itemForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemForm.id ? body : { ...body, projectId: selectedProjectId }),
      });
      setMessage({ type: 'success', text: itemForm.id ? `Item ${body.code} diperbarui.` : `Item ${body.code} ditambahkan.` });
      setItemForm(null);
      await loadData();
    } catch (err) {
      await showAlert(err.message, 'Gagal');
    } finally {
      setSavingItem(false);
    }
  };

  // ─── Upload BOQ ──────────────────────────────────────────────────────────
  const uploadFile = async (file) => {
    if (!file || !selectedProjectId || readOnly) return;
    if (!/\.xlsx?$/i.test(file.name)) {
      setMessage({ type: 'error', text: 'Format file harus .xlsx atau .xls.' });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Ukuran file melebihi batas 4 MB.' });
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('projectId', selectedProjectId);
      fd.append('file', file);
      const res = await apiFetch('/api/boq/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: `${json.count} item BOQ berhasil diimpor. Lanjutkan dengan mengisi jadwal item.` });
        await loadData();
        setActiveTab('schedule');
      } else {
        setMessage({ type: 'error', text: `${json.error}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: `${err.message}` });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── Simpan jadwal ───────────────────────────────────────────────────────
  const saveSchedule = async () => {
    const invalid = leaves.find((l) => {
      const v = scheduleEdits[l.id];
      return v?.startMonth && v?.endMonth && v.endMonth < v.startMonth;
    });
    if (invalid) {
      await showAlert(`Bulan selesai untuk ${invalid.code} lebih awal dari bulan mulai.`, 'Periksa jadwal');
      return;
    }
    setSavingSchedule(true);
    try {
      const updates = Object.entries(scheduleEdits)
        .map(([id, v]) => ({ id, startMonth: v.startMonth || null, endMonth: v.endMonth || null }));
      const res = await apiFetch('/api/boq/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: `Jadwal ${json.updated} item tersimpan.` });
        await loadData();
      }
    } catch (e) {
      setMessage({ type: 'error', text: `${e.message}` });
    } finally {
      setSavingSchedule(false);
    }
  };

  const saveActual = async (item, edit) => {
    const progress = parseFloat(edit.progressPct) || 0;
    if (progress < 0 || progress > 100) {
      await showAlert('Persentase kemajuan harus di antara 0 dan 100.', 'Periksa kembali');
      return;
    }
    setSavingActual(item.id);
    try {
      await apiFetch('/api/boq/actual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boqItemId: item.id, projectId: selectedProjectId, month: selectedMonth, progressPct: progress, costActual: parseFloat(edit.costActual) || 0, notes: edit.notes }),
      });
      setMessage({ type: 'success', text: `Realisasi ${item.code} bulan ${fmtMonth(selectedMonth)} tersimpan.` });
      await loadData();
    } catch (error) {
      await showAlert(error.message, 'Gagal menyimpan realisasi');
    } finally {
      setSavingActual(null);
    }
  };

  if (!projects?.length) {
    return (
      <div className="card empty-state">
        <FileSpreadsheet aria-hidden />
        <h3>Belum ada proyek</h3>
        <p>Tambahkan proyek di menu Proyek sebelum mengelola BOQ dan kurva S.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="form-group" style={{ flex: '1 1 320px', maxWidth: 480 }}>
          <label className="form-label" htmlFor="sc-project">Proyek</label>
          <select id="sc-project" value={selectedProjectId} onChange={(e) => { setSelectedProjectId(e.target.value); setMessage(null); }} className="form-select">
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={loading ? 'spin' : ''} aria-hidden /> Muat ulang
        </button>
        {readOnly && <span className="badge badge-gray" style={{ alignSelf: 'center' }}>Mode lihat saja</span>}
      </div>

      {selectedProject && (
        <div className="kpi-grid">
          <div className="kpi-card navy">
            <div className="kpi-label">Nilai kontrak</div>
            <div className="kpi-value">{fmtIDR(selectedProject.contractValue)}</div>
            <div className="kpi-trend">{selectedProject.client || '-'}</div>
          </div>
          <div className="kpi-card orange">
            <div className="kpi-label">Item BOQ (detail)</div>
            <div className="kpi-value">{hasBoq ? `${leaves.length} item` : 'Belum ada'}</div>
            <div className="kpi-trend">{hasBoq ? `Total bobot ${data.summary?.totalWeight}%` : 'Unggah file .xlsx'}</div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-label">Terjadwal</div>
            <div className="kpi-value">{hasBoq ? `${scheduledPct}%` : '-'}</div>
            <div className="kpi-trend">{hasBoq ? `${scheduledCount} dari ${leaves.length} item detail` : '-'}</div>
          </div>
          <div className="kpi-card blue">
            <div className="kpi-label">Rencana kumulatif</div>
            <div className="kpi-value">{lastPlan != null ? pct(lastPlan) : '-'}</div>
            <div className="kpi-trend">hingga akhir jadwal</div>
          </div>
        </div>
      )}

      <div className="card">

        {message && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ margin: '16px 20px 0' }}>
            {message.type === 'success' ? <CheckCircle aria-hidden /> : <Info aria-hidden />}
            <span style={{ flex: 1 }}>{message.text}</span>
            <button className="btn-ghost" style={{ minHeight: 0, padding: '0 6px' }} onClick={() => setMessage(null)} aria-label="Tutup pesan">✕</button>
          </div>
        )}

        {loading && !data ? (
          <div className="loading-block"><Loader2 size={30} className="spin" /> Memuat data…</div>
        ) : (
          <>
            {/* TAB: KURVA-S */}
            {activeTab === 'scurve' && (
              <div className="card-body">
                {!hasBoq ? <NeedBoq onGo={() => setActiveTab('boq')} /> : !data?.scurveData?.length ? (
                  <div className="empty-state">
                    <Calendar aria-hidden />
                    <h3>Jadwal belum diisi</h3>
                    <p>Isi bulan mulai dan selesai untuk setiap item detail di tab &quot;Jadwal item&quot; agar kurva S terbentuk.</p>
                    <button className="btn btn-primary" onClick={() => setActiveTab('schedule')}><Calendar aria-hidden /> Atur jadwal</button>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                      <h3 style={{ fontSize: 16 }}>Kurva S — rencana vs realisasi</h3>
                      <div className="chart-legend" style={{ margin: 0 }}>
                        <span className="legend-item"><span className="legend-line" style={{ background: 'var(--chart-1)' }} /> Rencana</span>
                        <span className="legend-item"><span className="legend-line" style={{ background: 'var(--chart-2)' }} /> Realisasi</span>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: 360 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data.scurveData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e3e6eb" vertical={false} />
                          <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 12, fill: '#646d79' }} />
                          <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: '#646d79' }} domain={[0, 100]} width={48} />
                          <Tooltip content={<CustomTooltip />} />
                          <ReferenceLine y={100} stroke="#ccd1d9" strokeDasharray="4 2" />
                          <Area type="monotone" dataKey="planned" fill="rgba(0,96,176,0.08)" stroke="#0060b0" strokeWidth={2.5} name="Rencana" dot={false} />
                          <Line type="monotone" dataKey="actual" stroke="#f07820" strokeWidth={2.5} name="Realisasi" dot={{ r: 3.5, fill: '#f07820' }} connectNulls={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {data.scurveData.some((d) => d.actual) && (() => {
                      const current = businessToday().slice(0, 7);
                      const upto = data.scurveData.filter((d) => d.month <= current);
                      const last = upto[upto.length - 1] ?? data.scurveData[0];
                      const deviation = last.actual - last.planned;
                      return (
                        <div className="grid-3" style={{ marginTop: 20 }}>
                          {[
                            { label: `Rencana s.d. ${fmtMonth(last.month)}`, value: pct(last.planned), color: 'var(--brand-700)' },
                            { label: `Realisasi s.d. ${fmtMonth(last.month)}`, value: pct(last.actual), color: 'var(--accent-600)' },
                            { label: 'Deviasi', value: `${deviation > 0 ? '+' : ''}${pct(deviation)}`, color: deviation >= 0 ? 'var(--green-600)' : 'var(--red-600)' },
                          ].map((s) => (
                            <div key={s.label} style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', padding: '14px 16px', textAlign: 'center' }}>
                              <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 4 }}>{s.label}</div>
                              <div style={{ fontSize: 22, fontWeight: 600, color: s.color }}>{s.value}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* TAB: UPLOAD BOQ */}
            {activeTab === 'boq' && (
              <div className="card-body">
                <div style={{ maxWidth: 620 }}>
                  <h3 style={{ fontSize: 16, marginBottom: 4 }}>Unggah file BOQ (.xlsx)</h3>
                  <p className="muted" style={{ fontSize: 14, marginBottom: 20 }}>
                    Gunakan format standar Prohaba (lihat Contoh BOQ.xlsx). Sistem membaca hierarki item, volume, harga, lalu menghitung bobot berdasarkan nilai kontrak proyek.
                    Mengunggah ulang akan mengganti item yang belum memiliki realisasi.
                  </p>

                  <div
                    role="button"
                    tabIndex={readOnly ? -1 : 0}
                    aria-disabled={readOnly}
                    className={`dropzone ${dragging ? 'dragging' : ''} ${readOnly ? 'disabled' : ''}`}
                    onClick={() => !readOnly && !uploading && fileInputRef.current?.click()}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !readOnly && fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); if (!readOnly) setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFile(e.dataTransfer.files?.[0]); }}
                  >
                    {uploading ? <Loader2 size={34} className="spin" /> : <FileSpreadsheet size={34} />}
                    <strong>{uploading ? 'Memproses file…' : readOnly ? 'Peran Anda tidak dapat mengunggah BOQ' : 'Klik untuk memilih file, atau seret file ke sini'}</strong>
                    <span>Format .xlsx / .xls, maksimal 4 MB</span>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => uploadFile(e.target.files?.[0])} />
                  </div>

                  {hasBoq && (
                    <div className="alert alert-success" style={{ marginTop: 16, alignItems: 'center' }}>
                      <CheckCircle aria-hidden />
                      <div style={{ flex: 1 }}>
                        <strong>BOQ sudah tersedia</strong>
                        <div style={{ fontSize: 13.5 }}>{leaves.length} item detail, total bobot {data.summary?.totalWeight}%</div>
                      </div>
                      <button className="btn btn-outline btn-sm" onClick={() => setActiveTab('schedule')}>Atur jadwal →</button>
                    </div>
                  )}

                  <div className="alert alert-info" style={{ marginTop: 16 }}>
                    <Info aria-hidden />
                    <div>
                      <strong>Kolom yang dikenali</strong>
                      <div style={{ fontSize: 13.5, marginTop: 2 }}>NO · URAIAN PEKERJAAN · VOLUME · SATUAN · HARGA BAHAN · HARGA UPAH · JUMLAH BAHAN · JUMLAH UPAH · TOTAL PRICE</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: JADWAL ITEM */}
            {activeTab === 'schedule' && (!hasBoq ? <div className="card-body"><NeedBoq onGo={() => setActiveTab('boq')} /></div> : (
              <>
                <div className="toolbar" style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-200)' }}>
                  <p className="muted" style={{ fontSize: 14, flex: '1 1 260px' }}>Isi bulan mulai dan selesai untuk setiap item detail. Baris kelompok dihitung otomatis.</p>
                  <button className="btn btn-outline" disabled={readOnly} onClick={() => setItemForm({ code: '', description: '', totalPrice: '' })}>
                    <Plus aria-hidden /> Tambah item
                  </button>
                  <button className="btn btn-primary" onClick={saveSchedule} disabled={readOnly || savingSchedule}>
                    {savingSchedule ? <Loader2 className="spin" aria-hidden /> : <Save aria-hidden />} Simpan jadwal
                  </button>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Uraian pekerjaan</th>
                        <th className="num">Total harga</th>
                        <th className="num">Bobot</th>
                        <th>Bulan mulai</th>
                        <th>Bulan selesai</th>
                        <th className="num">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} style={{ background: item.level === 1 ? 'var(--brand-50)' : undefined }}>
                          <td style={{ paddingLeft: 16 + (levelIndent[item.level] ?? 48), minWidth: 280 }}>
                            <span style={levelStyle[item.level] ?? levelStyle[4]}>{item.code}&nbsp; {item.description}</span>
                          </td>
                          <td className="num nowrap" style={{ fontWeight: item.level <= 2 ? 600 : 400 }}>{item.totalPrice ? fmtIDR(item.totalPrice) : '—'}</td>
                          <td className="num nowrap" style={{ fontWeight: 600, color: 'var(--brand-700)' }}>{item.weight != null ? `${item.weight.toFixed(2)}%` : '—'}</td>
                          <td style={{ padding: '8px 10px' }}>
                            {item.isLeaf && (
                              <input disabled={readOnly} type="month" className="form-input" aria-label={`Bulan mulai ${item.code}`} style={{ minHeight: 38, width: 160 }}
                                value={scheduleEdits[item.id]?.startMonth || ''}
                                onChange={(e) => setScheduleEdits((prev) => ({ ...prev, [item.id]: { ...prev[item.id], startMonth: e.target.value } }))}
                              />
                            )}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {item.isLeaf && (
                              <input disabled={readOnly} type="month" className="form-input" aria-label={`Bulan selesai ${item.code}`} style={{ minHeight: 38, width: 160 }}
                                min={scheduleEdits[item.id]?.startMonth || undefined}
                                value={scheduleEdits[item.id]?.endMonth || ''}
                                onChange={(e) => setScheduleEdits((prev) => ({ ...prev, [item.id]: { ...prev[item.id], endMonth: e.target.value } }))}
                              />
                            )}
                          </td>
                          <td>
                            <div className="row-actions">
                              <button disabled={readOnly} onClick={() => setItemForm({ id: item.id, code: item.code || '', description: item.description || '', totalPrice: item.totalPrice ?? '' })} className="action-btn" title="Ubah item" aria-label={`Ubah ${item.code}`}>
                                <Edit />
                              </button>
                              <button disabled={readOnly} onClick={() => handleDeleteBoqItem(item)} className="action-btn danger" title="Hapus item" aria-label={`Hapus ${item.code}`}>
                                <Trash2 />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ))}

            {/* TAB: INPUT REALISASI */}
            {activeTab === 'actual' && (!hasBoq ? <div className="card-body"><NeedBoq onGo={() => setActiveTab('boq')} /></div> : (
              <>
                <div className="toolbar" style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-200)' }}>
                  <div className="form-group" style={{ minWidth: 200 }}>
                    <label className="form-label" htmlFor="sc-month">Bulan realisasi</label>
                    <input id="sc-month" type="month" className="form-input" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
                  </div>
                  <p className="muted" style={{ fontSize: 14, alignSelf: 'center', flex: '1 1 260px' }}>
                    Isi persentase kemajuan setiap item untuk bulan {fmtMonth(selectedMonth)}, lalu tekan Simpan pada baris tersebut.
                  </p>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Uraian pekerjaan</th>
                        <th className="num">Bobot</th>
                        <th>% selesai bulan ini</th>
                        <th>Biaya aktual (Rp)</th>
                        <th>Catatan</th>
                        <th className="num">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaves.map((item) => {
                        const existing = item.actuals?.find((a) => a.month === selectedMonth);
                        const editKey = selectedProjectId + ':' + selectedMonth + ':' + item.id;
                        const edit = actualEdits[editKey] || { progressPct: existing?.progressPct ?? '', costActual: existing?.costActual ?? '', notes: existing?.notes ?? '' };
                        const update = (key) => (e) => setActualEdits((prev) => ({ ...prev, [editKey]: { ...edit, [key]: e.target.value } }));
                        return (
                          <tr key={item.id}>
                            <td style={{ minWidth: 260 }}>
                              <span style={levelStyle[item.level] ?? levelStyle[4]}>{item.code} {item.description}</span>
                              {item.startMonth && <div className="cell-sub">Jadwal {fmtMonth(item.startMonth)} – {fmtMonth(item.endMonth)}</div>}
                            </td>
                            <td className="num nowrap" style={{ color: 'var(--brand-700)', fontWeight: 600 }}>{item.weight != null ? `${item.weight.toFixed(2)}%` : '—'}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input disabled={readOnly} type="number" min="0" max="100" step="0.5" className="form-input" placeholder="0" aria-label={`Persen selesai ${item.code}`}
                                  style={{ width: 90, minHeight: 38, textAlign: 'right' }} value={edit.progressPct} onChange={update('progressPct')} />
                                <span className="muted">%</span>
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <input disabled={readOnly} type="number" min="0" className="form-input" placeholder="0" aria-label={`Biaya aktual ${item.code}`}
                                style={{ width: 150, minHeight: 38 }} value={edit.costActual} onChange={update('costActual')} />
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <input disabled={readOnly} type="text" className="form-input" placeholder="Keterangan" aria-label={`Catatan ${item.code}`}
                                style={{ width: 200, minHeight: 38 }} value={edit.notes} onChange={update('notes')} />
                            </td>
                            <td className="num">
                              <button className="btn btn-sm btn-primary" disabled={readOnly || savingActual === item.id} onClick={() => saveActual(item, edit)}>
                                {savingActual === item.id ? 'Menyimpan…' : 'Simpan'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ))}

            {/* TAB: LAPORAN */}
            {activeTab === 'report' && (!hasBoq ? <div className="card-body"><NeedBoq onGo={() => setActiveTab('boq')} /></div> : (
              <>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-200)' }}>
                  <h3 style={{ fontSize: 16 }}>Rencana vs realisasi per kelompok pekerjaan</h3>
                  <p className="muted" style={{ fontSize: 14, marginTop: 2 }}>
                    Rencana dihitung merata per bulan sesuai jadwal item, sampai bulan {fmtMonth(businessToday().slice(0, 7))}. Persentase relatif terhadap bobot kelompok.
                  </p>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Kode</th>
                        <th>Uraian pekerjaan</th>
                        <th className="num">Bobot</th>
                        <th className="num">Rencana</th>
                        <th className="num">Realisasi</th>
                        <th className="num">Deviasi</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.map(({ group, weight, planned, actual, scheduled }) => {
                        const deviation = actual - planned;
                        const status = actual >= 99.95 ? ['Selesai', 'success']
                          : !scheduled ? ['Belum dijadwalkan', 'gray']
                            : deviation < -5 ? ['Terlambat', 'danger']
                              : actual > 0 ? ['Berjalan', 'info'] : planned > 0 ? ['Belum mulai', 'warning'] : ['Belum waktunya', 'gray'];
                        return (
                          <tr key={group.id} style={{ background: group.level === 1 ? 'var(--brand-50)' : undefined }}>
                            <td className="nowrap" style={{ fontWeight: 600, color: 'var(--brand-700)' }}>{group.code}</td>
                            <td style={{ paddingLeft: 16 + (levelIndent[group.level] ?? 0), minWidth: 240 }}>
                              <span style={levelStyle[group.level] ?? levelStyle[4]}>{group.description}</span>
                            </td>
                            <td className="num">{weight.toFixed(2)}%</td>
                            <td className="num" style={{ color: 'var(--brand-700)', fontWeight: 600 }}>{scheduled ? pct(planned) : '—'}</td>
                            <td className="num" style={{ color: 'var(--accent-600)', fontWeight: 600 }}>{pct(actual)}</td>
                            <td className="num" style={{ fontWeight: 600, color: !scheduled ? 'var(--gray-400)' : deviation >= 0 ? 'var(--green-600)' : 'var(--red-600)' }}>
                              {scheduled ? `${deviation > 0 ? '+' : ''}${pct(deviation)}` : '—'}
                            </td>
                            <td><span className={`badge badge-${status[1]}`}>{status[0]}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ))}
          </>
        )}
      </div>

      {itemForm && (
        <Modal
          title={itemForm.id ? 'Ubah item BOQ' : 'Tambah item BOQ'}
          subtitle={selectedProject ? `${selectedProject.code} — ${selectedProject.name}` : undefined}
          onClose={() => setItemForm(null)}
          busy={savingItem}
          size="modal-sm"
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setItemForm(null)} disabled={savingItem}>Batal</button>
              <button type="submit" form="boq-item-form" className="btn btn-primary" disabled={savingItem}>{savingItem ? 'Menyimpan…' : 'Simpan'}</button>
            </>
          }
        >
          <form id="boq-item-form" onSubmit={saveItem} className="form-stack">
            <div className="form-group">
              <label className="form-label required" htmlFor="boq-code">Kode / nomor</label>
              <input id="boq-code" className="form-input" value={itemForm.code} onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })} placeholder="Misal: A.8" required />
              <div className="form-hint">Gunakan titik untuk hierarki, misal A.8.1 berada di bawah A.8.</div>
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="boq-desc">Uraian pekerjaan</label>
              <textarea id="boq-desc" className="form-input" rows={3} value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="boq-price">Total harga (Rp)</label>
              <input id="boq-price" type="number" min="0" className="form-input" value={itemForm.totalPrice} onChange={(e) => setItemForm({ ...itemForm, totalPrice: e.target.value })} placeholder="0" />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
