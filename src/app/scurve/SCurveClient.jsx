'use client';
import { apiFetch } from '@/lib/client-api';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDialog } from '@/components/DialogProvider';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart,
} from 'recharts';
import {
  Plus, Upload, FileSpreadsheet, Calendar, BarChart2, Table2,
  CheckCircle, AlertTriangle, TrendingUp, TrendingDown,
  ChevronDown, ChevronRight, Save, RefreshCw, Download, Edit, Trash2,
  Loader2, Info, Activity,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────
const fmtIDR = (v) => {
  if (!v) return '-';
  if (v >= 1e9) return `Rp ${(v / 1e9).toFixed(1)}M`;
  if (v >= 1e6) return `Rp ${(v / 1e6).toFixed(0)}jt`;
  return `Rp ${v.toLocaleString('id-ID')}`;
};

const MONTHS_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
const fmtMonth = (m) => {
  if (!m) return '-';
  const [y, mo] = m.split('-');
  return `${MONTHS_ID[parseInt(mo)-1]} ${y}`;
};

const levelIndent = { 1: 0, 2: 16, 3: 32, 4: 44 };
const levelStyle = {
  1: { fontWeight: 700, fontSize: 13, color: 'var(--navy-800)', textTransform: 'uppercase', letterSpacing: 0.3 },
  2: { fontWeight: 600, fontSize: 13, color: 'var(--gray-800)' },
  3: { fontWeight: 500, fontSize: 12.5, color: 'var(--gray-700)' },
  4: { fontWeight: 400, fontSize: 12, color: 'var(--gray-500)' },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'white', border:'1px solid var(--gray-200)', borderRadius:'var(--radius-md)', padding:'10px 14px', boxShadow:'var(--shadow-lg)', fontSize:12.5 }}>
      <div style={{ fontWeight:700, color:'var(--gray-900)', marginBottom:8 }}>{fmtMonth(label)}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <div style={{ width:10, height:10, borderRadius:2, background:p.color }} />
          <span style={{ color:'var(--gray-600)' }}>{p.name}:</span>
          <strong style={{ color:p.color }}>{Number(p.value).toFixed(1)}%</strong>
        </div>
      ))}
      {payload.length >= 2 && payload[0].value != null && payload[1].value != null && (
        <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--gray-100)', fontSize:12 }}>
          <span style={{ color: payload[0].value > payload[1].value ? 'var(--red-500)' : 'var(--green-500)', fontWeight:600 }}>
            {payload[0].value > payload[1].value ? '⚠ Behind ' : '✓ Ahead '}
            {Math.abs(payload[0].value - payload[1].value).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────
export default function SCurveClient({ projects, user }) {
  const readOnly = user?.role === 'FINANCE';
  const [selectedProjectId, setSelectedProjectId] = useState(projects?.[0]?.id || '');
  const [activeTab, setActiveTab] = useState('scurve');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [scheduleEdits, setScheduleEdits] = useState({});
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [actualEdits, setActualEdits] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });
  const [collapsed, setCollapsed] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ code: "", description: "", totalPrice: "" });
  const { showConfirm, showAlert } = useDialog();

  const fileInputRef = useRef();

  const selectedProject = projects?.find(p => p.id === selectedProjectId);

  const loadData = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/scurve?projectId=${selectedProjectId}`);
      const json = await res.json();
      setData(json);
      // Init schedule edits from existing data
      const edits = {};
      json.boqItems?.forEach(item => {
        if (item.isLeaf) edits[item.id] = { startMonth: item.startMonth || '', endMonth: item.endMonth || '' };
      });
      setScheduleEdits(edits);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => { const timer=setTimeout(loadData,0); return ()=>clearTimeout(timer); }, [loadData]);

  
  // ─── Edit / Delete BOQ Item ────────────────────────────────────
  const handleDeleteBoqItem = async (item) => {
    const ok = await showConfirm(`Yakin hapus ${item.code} - ${item.description}?`, 'Hapus Item');
    if (!ok) return;
    try {
      const res = await apiFetch(`/api/boq/item/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal dari server');
      await showAlert('Item berhasil dihapus', 'Sukses');
      setUploadMsg(null);
      loadData();
    } catch(e) {
      await showAlert('Gagal hapus item', 'Error');
    }
  };

  
  const saveNewItem = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/boq/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          code: newItem.code,
          description: newItem.description,
          totalPrice: parseFloat(newItem.totalPrice) || 0
        })
      });

      if (!res.ok) throw new Error('Gagal menambahkan item BOQ');
      
      await loadData(); // refresh all data including summary
      setNewItem({ code: '', description: '', totalPrice: '' });
      setIsAddingItem(false);
      showAlert('Item berhasil ditambahkan', 'Sukses');
    } catch (err) {
      console.error(err);
      showAlert(err.message, 'Error');
    }
  };

  const saveItemEdit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/api/boq/item/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: editingItem.code,
          description: editingItem.description,
          totalPrice: parseFloat(editingItem.totalPrice) || 0
        })
      });
      if (res.ok) {
        setEditingItem(null);
        setUploadMsg(null);
        await showAlert('Item berhasil diperbarui', 'Sukses');
        loadData();
      } else {
        throw new Error('Gagal update item');
      }
    } catch(err) {
      await showAlert(err.message, 'Error');
    }
  };

  // ─── Upload BOQ ────────────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append('projectId', selectedProjectId);
      fd.append('file', file);
      const res = await apiFetch('/api/boq/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.success) {
        setUploadMsg({ type: 'success', text: `${json.count} item BOQ berhasil diimpor` });
        await loadData();
        setActiveTab('schedule');
      } else {
        setUploadMsg({ type: 'error', text: `${json.error}` });
      }
    } catch (err) {
      setUploadMsg({ type: 'error', text: `${err.message}` });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── Save Schedule ─────────────────────────────────────────────
  const saveSchedule = async () => {
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
        setUploadMsg({ type: 'success', text: `Jadwal ${json.updated} item tersimpan` });
        await loadData();
      }
    } catch (e) {
      setUploadMsg({ type: 'error', text: `${e.message}` });
    } finally {
      setSavingSchedule(false);
    }
  };

  const tabs = [
    { id: 'scurve', label: 'Kurva S', icon: Activity },
    { id: 'boq', label: 'Upload BOQ', icon: Upload },
    { id: 'schedule', label: 'Jadwal Item', icon: Calendar },
    { id: 'actual', label: 'Input Realisasi', icon: Table2 },
    { id: 'report', label: 'Laporan', icon: BarChart2 },
  ];

  const hasBoq = data?.boqItems?.length > 0;
  const scheduledPct = hasBoq
    ? Math.round((data.boqItems.filter(i => i.startMonth && i.endMonth).length / data.boqItems.length) * 100)
    : 0;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="page-header-text">
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy-800)' }}>S-Curve & Progress</h1>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>
            Monitoring rencana vs realisasi berbasis BOQ
          </p>
        </div>
        <div className="page-header-actions">
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="form-input"
            style={{ width: 260, height: 38, fontSize: 13 }}
          >
            {projects?.map(p => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
          <button className="btn btn-outline" onClick={loadData} disabled={loading} style={{ height: 38 }}>
            <RefreshCw size={14} style={{ marginRight: 6, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      {selectedProject && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Nilai Kontrak', value: fmtIDR(selectedProject.contractValue), color: 'navy', sub: selectedProject.client },
            { label: 'Item BOQ', value: hasBoq ? `${data.boqItems.length} item` : 'Belum upload', color: 'orange', sub: hasBoq ? `${data.summary?.totalWeight}% total bobot` : 'Upload file .xlsx' },
            { label: 'Terjadwal', value: hasBoq ? `${scheduledPct}%` : '-', color: 'green', sub: hasBoq ? `${data.boqItems.filter(i=>i.startMonth&&i.endMonth).length} dari ${data.boqItems.length} item` : '-' },
            { label: 'Progress Plan', value: data?.scurveData?.length ? `${data.scurveData[data.scurveData.length-1]?.planned?.toFixed(1)}%` : '-', color: 'blue', sub: 'Hingga akhir jadwal' },
          ].map((kpi, i) => (
            <div key={i} className={`kpi-card ${kpi.color}`}>
              <div className="kpi-label">{kpi.label}</div>
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-trend">{kpi.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display:'flex', borderBottom:'1px solid var(--gray-200)', background:'var(--gray-50)', overflowX:'auto', scrollbarWidth:'none' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding:'13px 20px', fontWeight:600, fontSize:13,
                color: isActive ? 'var(--navy-800)' : 'var(--gray-500)',
                display:'flex', alignItems:'center', gap:7, background:'transparent',
                border:'none', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
                borderBottom: isActive ? '3px solid var(--orange-500)' : '3px solid transparent',
                transition:'all 0.2s',
              }}>
                <Icon size={15} style={{ color: isActive ? 'var(--orange-500)' : 'var(--gray-400)' }} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Upload message */}
        {uploadMsg && (
          <div style={{ padding:'10px 20px', background: uploadMsg.type==='success' ? 'var(--green-50)' : 'var(--red-50)', borderBottom:'1px solid var(--gray-100)', fontSize:13, color: uploadMsg.type==='success' ? 'var(--green-700)' : 'var(--red-600)' }}>
            {uploadMsg.text}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* TAB: KURVA-S */}
          {activeTab === 'scurve' && (
            <motion.div key="scurve" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.2}} style={{ padding: 24 }}>
              {loading ? (
                <div style={{ textAlign:'center', padding:60, color:'var(--gray-400)' }}>
                  <Loader2 size={32} style={{ animation:'spin 1s linear infinite', margin:'0 auto 12px' }} />
                  <div>Memuat data...</div>
                </div>
              ) : !hasBoq ? (
                <div style={{ textAlign:'center', padding:60 }}>
                  <FileSpreadsheet size={48} style={{ color:'var(--gray-300)', margin:'0 auto 16px' }} />
                  <div style={{ fontWeight:600, color:'var(--gray-600)', marginBottom:8 }}>Belum ada data BOQ</div>
                  <div style={{ color:'var(--gray-400)', fontSize:13, marginBottom:20 }}>Upload file BOQ.xlsx terlebih dahulu di tab &quot;Upload BOQ&quot;</div>
                  <button className="btn btn-primary" onClick={() => setActiveTab('boq')}>
                    <Upload size={14} style={{ marginRight:6 }} /> Upload BOQ
                  </button>
                </div>
              ) : data?.scurveData?.length === 0 ? (
                <div style={{ textAlign:'center', padding:60 }}>
                  <Calendar size={48} style={{ color:'var(--gray-300)', margin:'0 auto 16px' }} />
                  <div style={{ fontWeight:600, color:'var(--gray-600)', marginBottom:8 }}>Jadwal belum diisi</div>
                  <div style={{ color:'var(--gray-400)', fontSize:13, marginBottom:20 }}>Isi bulan mulai & selesai per item di tab &quot;Jadwal Item&quot; untuk generate kurva-S</div>
                  <button className="btn btn-primary" onClick={() => setActiveTab('schedule')}>
                    <Calendar size={14} style={{ marginRight:6 }} /> Atur Jadwal
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                    <div style={{ fontWeight:600, fontSize:15, color:'var(--navy-800)' }}>Kurva S — Plan vs Aktual</div>
                    <div style={{ display:'flex', gap:20, fontSize:12 }}>
                      <span style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:24, height:3, background:'var(--navy-600)', display:'inline-block', borderRadius:2 }}></span> Rencana</span>
                      <span style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:24, height:3, background:'var(--orange-500)', display:'inline-block', borderRadius:2, borderTop:'2px dashed var(--orange-500)' }}></span> Aktual</span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={360}>
                    <ComposedChart data={data.scurveData} margin={{ top:5, right:20, left:0, bottom:5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                      <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize:11, fill:'var(--gray-500)' }} />
                      <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize:11, fill:'var(--gray-500)' }} domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={100} stroke="var(--gray-200)" strokeDasharray="4 2" />
                      <Area type="monotone" dataKey="planned" fill="rgba(30,58,138,0.05)" stroke="var(--navy-600)" strokeWidth={2.5} name="Rencana" dot={false} />
                      <Line type="monotone" dataKey="actual" stroke="var(--orange-500)" strokeWidth={2.5} strokeDasharray="6 3" name="Aktual" dot={{ r:4, fill:'var(--orange-500)' }} connectNulls={false} />
                    </ComposedChart>
                  </ResponsiveContainer>

                  {/* Deviation summary */}
                  {data.scurveData.some(d => d.actual != null) && (
                    <div style={{ marginTop:24, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                      {(() => {
                        const last = [...data.scurveData].reverse().find(d => d.actual != null);
                        const deviation = last ? last.actual - last.planned : 0;
                        return [
                          { label:'Plan Kumulatif', value:`${data.scurveData[data.scurveData.length-1]?.planned?.toFixed(1)}%`, color:'var(--navy-700)' },
                          { label:'Aktual Kumulatif', value: last ? `${last.actual.toFixed(1)}%` : '-', color:'var(--orange-500)' },
                          { label:'Deviasi', value: last ? `${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%` : '-', color: deviation >= 0 ? 'var(--green-600)' : 'var(--red-600)' },
                        ].map((s, i) => (
                          <div key={i} style={{ background:'var(--gray-50)', borderRadius:'var(--radius-md)', padding:'12px 16px', textAlign:'center' }}>
                            <div style={{ fontSize:11, color:'var(--gray-500)', marginBottom:4 }}>{s.label}</div>
                            <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* TAB: UPLOAD BOQ */}
          {activeTab === 'boq' && (
            <motion.div key="boq" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.2}} style={{ padding:24 }}>
              <div style={{ maxWidth:560 }}>
                <div style={{ fontWeight:600, fontSize:15, color:'var(--navy-800)', marginBottom:4 }}>Upload File BOQ (.xlsx)</div>
                <div style={{ fontSize:13, color:'var(--gray-500)', marginBottom:24 }}>
                  File Excel harus menggunakan format standar Prohaba (Contoh BOQ.xlsx). Sistem akan otomatis parsing hierarki item, volume, harga, dan menghitung bobot berdasarkan nilai kontrak proyek.
                </div>

                <div
                  disabled={readOnly} onClick={() => fileInputRef.current?.click()}
                  style={{
                    border:'2px dashed var(--gray-300)', borderRadius:'var(--radius-lg)',
                    padding:'40px 32px', textAlign:'center', cursor:'pointer',
                    background:'var(--gray-50)', transition:'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orange-400)'; e.currentTarget.style.background = 'var(--orange-50)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gray-300)'; e.currentTarget.style.background = 'var(--gray-50)'; }}
                >
                  {uploading ? (
                    <Loader2 size={36} style={{ color:'var(--orange-500)', animation:'spin 1s linear infinite', margin:'0 auto 12px' }} />
                  ) : (
                    <FileSpreadsheet size={36} style={{ color:'var(--orange-500)', margin:'0 auto 12px' }} />
                  )}
                  <div style={{ fontWeight:600, color:'var(--gray-700)', marginBottom:6 }}>
                    {uploading ? 'Memproses...' : 'Klik untuk pilih file atau drag & drop'}
                  </div>
                  <div style={{ fontSize:12, color:'var(--gray-400)' }}>Format .xlsx, maksimal 10MB</div>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleUpload} />
                </div>

                {hasBoq && (
                  <div style={{ marginTop:20, padding:'12px 16px', background:'var(--green-50)', borderRadius:'var(--radius-md)', border:'1px solid var(--green-200)', display:'flex', alignItems:'center', gap:10 }}>
                    <CheckCircle size={18} style={{ color:'var(--green-600)', flexShrink:0 }} />
                    <div>
                      <div style={{ fontWeight:600, fontSize:13, color:'var(--green-700)' }}>BOQ sudah tersedia</div>
                      <div style={{ fontSize:12, color:'var(--green-600)' }}>{data.boqItems.length} item, total bobot {data.summary?.totalWeight}%</div>
                    </div>
                    <button className="btn btn-outline" style={{ marginLeft:'auto', fontSize:12, height:30 }} onClick={() => setActiveTab('schedule')}>
                      Atur Jadwal →
                    </button>
                  </div>
                )}

                <div style={{ marginTop:24, padding:'14px 16px', background:'var(--navy-50)', borderRadius:'var(--radius-md)', border:'1px solid var(--navy-100)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <Info size={14} style={{ color:'var(--navy-600)' }} />
                    <span style={{ fontWeight:600, fontSize:13, color:'var(--navy-700)' }}>Format Kolom yang Dikenali</span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--navy-600)', lineHeight:1.8 }}>
                    NO · URAIAN PEKERJAAN · VOLUME · SATUAN · HARGA BAHAN · HARGA UPAH · JUMLAH BAHAN · JUMLAH UPAH · TOTAL PRICE
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: JADWAL ITEM */}
          {activeTab === 'schedule' && (
            <motion.div key="schedule" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.2}}>
              {!hasBoq ? (
                <div style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>
                  Upload BOQ terlebih dahulu
                </div>
              ) : (
                <>
                  <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                    <div style={{ fontSize:13, color:'var(--gray-600)' }}>Atur bulan mulai & selesai per item.</div>
                    <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                      <button className="btn btn-outline" disabled={readOnly} onClick={() => setIsAddingItem(true)} style={{ height:36 }}>
                        <Plus size={14} style={{ marginRight:6 }} />
                        Tambah Item
                      </button>
                      <button className="btn btn-primary" onClick={saveSchedule} disabled={readOnly || savingSchedule} style={{ height:36 }}>
                      {savingSchedule ? <Loader2 size={14} style={{ animation:'spin 1s linear infinite', marginRight:6 }} /> : <Save size={14} style={{ marginRight:6 }} />}
                      Simpan Jadwal
                    </button>
                    </div>
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                      <thead>
                        <tr style={{ background:'var(--gray-50)', borderBottom:'1px solid var(--gray-200)' }}>
                          <th style={{ padding:'10px 16px', textAlign:'left', color:'var(--gray-500)', fontWeight:600, fontSize:11 }}>URAIAN PEKERJAAN</th>
                          <th style={{ padding:'10px 12px', textAlign:'right', color:'var(--gray-500)', fontWeight:600, fontSize:11 }}>TOTAL PRICE</th>
                          <th style={{ padding:'10px 12px', textAlign:'center', color:'var(--gray-500)', fontWeight:600, fontSize:11 }}>BOBOT %</th>
                          <th style={{ padding:'10px 12px', textAlign:'center', color:'var(--gray-500)', fontWeight:600, fontSize:11 }}>BULAN MULAI</th>
                          <th style={{ padding:'10px 12px', textAlign:'center', color:'var(--gray-500)', fontWeight:600, fontSize:11 }}>BULAN SELESAI</th>
                          <th style={{ padding:'10px 12px', textAlign:'center', color:'var(--gray-500)', fontWeight:600, fontSize:11 }}>AKSI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.boqItems.map((item) => (
                          <tr key={item.id} style={{ borderBottom:'1px solid var(--gray-100)', background: item.level === 1 ? 'var(--navy-50)' : 'white' }}>
                            <td style={{ padding:'8px 16px', paddingLeft: 16 + levelIndent[item.level] }}>
                              <span style={levelStyle[item.level]}>{item.code} &nbsp;</span>
                              <span style={levelStyle[item.level]}>{item.description}</span>
                            </td>
                            <td style={{ padding:'8px 12px', textAlign:'right', color:'var(--gray-700)', fontWeight: item.level<=2?600:400 }}>
                              {item.totalPrice ? fmtIDR(item.totalPrice) : '—'}
                            </td>
                            <td style={{ padding:'8px 12px', textAlign:'center' }}>
                              {item.weight != null ? (
                                <span style={{ fontWeight:600, color:'var(--navy-700)' }}>{item.weight.toFixed(2)}%</span>
                              ) : '—'}
                            </td>
                            <td style={{ padding:'6px 8px' }}>
                              {item.level >= 2 && (
                                <input disabled={readOnly} type="month" className="form-input" style={{ fontSize:12, height:30, padding:'0 8px', width:140 }}
                                  value={scheduleEdits[item.id]?.startMonth || ''}
                                  onChange={e => setScheduleEdits(prev => ({ ...prev, [item.id]: { ...prev[item.id], startMonth: e.target.value } }))}
                                />
                              )}
                            </td>
                            <td style={{ padding:'6px 8px' }}>
                              {item.level >= 2 && (
                                <input disabled={readOnly} type="month" className="form-input" style={{ fontSize:12, height:30, padding:'0 8px', width:140 }}
                                  value={scheduleEdits[item.id]?.endMonth || ''}
                                  onChange={e => setScheduleEdits(prev => ({ ...prev, [item.id]: { ...prev[item.id], endMonth: e.target.value } }))}
                                />
                              )}
                            </td>
                            <td style={{ padding:'6px 8px', textAlign:'center' }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                <button disabled={readOnly} onClick={() => setEditingItem(item)} className="btn btn-sm btn-outline" style={{ padding: 4, height: 26, width: 26, display:'flex', alignItems:'center', justifyContent:'center' }} title="Edit Item">
                                  <Edit size={12} />
                                </button>
                                <button disabled={readOnly} onClick={() => handleDeleteBoqItem(item)} className="btn btn-sm btn-outline" style={{ padding: 4, height: 26, width: 26, color: 'var(--red-500)', borderColor: 'var(--red-200)', display:'flex', alignItems:'center', justifyContent:'center' }} title="Hapus Item">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* TAB: INPUT REALISASI */}
          {activeTab === 'actual' && (
            <motion.div key="actual" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.2}}>
              {!hasBoq ? (
                <div style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>Upload BOQ terlebih dahulu</div>
              ) : (
                <>
                  <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                    <label style={{ fontSize:13, fontWeight:600, color:'var(--gray-700)' }}>Bulan Realisasi:</label>
                    <input disabled={readOnly} type="month" className="form-input" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ width:160, height:36, fontSize:13 }} />
                    <span style={{ fontSize:12, color:'var(--gray-400)' }}>Input % kemajuan per item untuk bulan ini</span>
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                      <thead>
                        <tr style={{ background:'var(--gray-50)', borderBottom:'1px solid var(--gray-200)' }}>
                          <th style={{ padding:'10px 16px', textAlign:'left', color:'var(--gray-500)', fontWeight:600, fontSize:11 }}>URAIAN PEKERJAAN</th>
                          <th style={{ padding:'10px 12px', textAlign:'center', color:'var(--gray-500)', fontWeight:600, fontSize:11 }}>BOBOT %</th>
                          <th style={{ padding:'10px 12px', textAlign:'center', color:'var(--gray-500)', fontWeight:600, fontSize:11 }}>% SELESAI BULAN INI</th>
                          <th style={{ padding:'10px 12px', textAlign:'center', color:'var(--gray-500)', fontWeight:600, fontSize:11 }}>BIAYA AKTUAL</th>
                          <th style={{ padding:'10px 12px', textAlign:'left', color:'var(--gray-500)', fontWeight:600, fontSize:11 }}>CATATAN</th>
                          <th style={{ padding:'10px 12px', textAlign:'center', color:'var(--gray-500)', fontWeight:600, fontSize:11 }}>AKSI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.boqItems.filter(i => i.isLeaf).map((item) => {
                          const existing = item.actuals?.find(a => a.month === selectedMonth);
                          const editKey = selectedProjectId + ":" + selectedMonth + ":" + item.id;
                          const edit = actualEdits[editKey] || { progressPct: existing?.progressPct ?? '', costActual: existing?.costActual ?? '', notes: existing?.notes ?? '' };
                          return (
                            <tr key={item.id} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                              <td style={{ padding:'8px 16px', paddingLeft: 16 + levelIndent[item.level] }}>
                                <span style={levelStyle[item.level]}>{item.code} {item.description}</span>
                                {item.startMonth && <div style={{ fontSize:11, color:'var(--gray-400)' }}>{fmtMonth(item.startMonth)} — {fmtMonth(item.endMonth)}</div>}
                              </td>
                              <td style={{ padding:'8px 12px', textAlign:'center', color:'var(--navy-700)', fontWeight:600 }}>
                                {item.weight?.toFixed(2) || '—'}%
                              </td>
                              <td style={{ padding:'6px 8px', textAlign:'center' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'center' }}>
                                  <input disabled={readOnly} type="number" min="0" max="100" step="0.5" className="form-input" placeholder="0"
                                    style={{ width:70, height:30, textAlign:'center', fontSize:12 }}
                                    value={edit.progressPct}
                                    onChange={e => setActualEdits(prev => ({ ...prev, [editKey]: { ...edit, progressPct: e.target.value } }))}
                                  />
                                  <span style={{ fontSize:11, color:'var(--gray-400)' }}>%</span>
                                </div>
                              </td>
                              <td style={{ padding:'6px 8px' }}>
                                <input disabled={readOnly} type="number" min="0" className="form-input" placeholder="0"
                                  style={{ width:120, height:30, fontSize:12 }}
                                  value={edit.costActual}
                                  onChange={e => setActualEdits(prev => ({ ...prev, [editKey]: { ...edit, costActual: e.target.value } }))}
                                />
                              </td>
                              <td style={{ padding:'6px 8px' }}>
                                <input disabled={readOnly} type="text" className="form-input" placeholder="Keterangan..."
                                  style={{ width:160, height:30, fontSize:12 }}
                                  value={edit.notes}
                                  onChange={e => setActualEdits(prev => ({ ...prev, [editKey]: { ...edit, notes: e.target.value } }))}
                                />
                              </td>
                              <td style={{ padding:'6px 8px', textAlign:'center' }}>
                                <button className="btn btn-sm btn-primary" style={{ height:28, fontSize:11 }}
                                  disabled={readOnly} onClick={async () => {
                                    try { await apiFetch('/api/boq/actual', {
                                      method:'POST',
                                      headers:{'Content-Type':'application/json'},
                                      body: JSON.stringify({ boqItemId: item.id, projectId: selectedProjectId, month: selectedMonth, progressPct: parseFloat(edit.progressPct)||0, costActual: parseFloat(edit.costActual)||0, notes: edit.notes })
                                    });
                                    setUploadMsg({ type:'success', text:`Realisasi ${item.code} bulan ${fmtMonth(selectedMonth)} tersimpan` });
                                    await loadData();
                                    } catch (error) { await showAlert(error.message, 'Gagal menyimpan realisasi'); }
                                  }}
                                >
                                  Simpan
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* TAB: LAPORAN */}
          {activeTab === 'report' && (
            <motion.div key="report" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.2}} style={{ padding:24 }}>
              {!hasBoq ? (
                <div style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>Upload BOQ terlebih dahulu</div>
              ) : (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:12 }}>
                    <div style={{ fontWeight:600, fontSize:15, color:'var(--navy-800)' }}>Plan vs Aktual per Kelompok Pekerjaan</div>
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                      <thead>
                        <tr style={{ background:'var(--navy-800)', color:'white' }}>
                          {['KODE','URAIAN PEKERJAAN','BOBOT %','RENCANA %','AKTUAL %','DEVIASI','STATUS'].map(h => (
                            <th key={h} style={{ padding:'10px 14px', textAlign: h==='URAIAN PEKERJAAN'?'left':'center', fontWeight:600, fontSize:11, letterSpacing:0.3 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.boqItems.filter(i => i.level <= 2 && i.totalPrice).map((item) => {
                          const totalPct = item.actuals?.reduce((s, a) => s + (a.progressPct || 0), 0) || 0;
                          const hasSchedule = item.startMonth && item.endMonth;
                          // Simple plan: linear from now
                          const deviation = totalPct;
                          const status = totalPct >= 100 ? 'Selesai' : totalPct > 50 ? 'Berjalan' : totalPct > 0 ? 'Mulai' : 'Belum';
                          const statusColor = totalPct >= 100 ? 'var(--green-600)' : totalPct > 0 ? 'var(--orange-500)' : 'var(--gray-400)';
                          return (
                            <tr key={item.id} style={{ borderBottom:'1px solid var(--gray-100)', background: item.level===1 ? 'var(--navy-50)' : 'white' }}>
                              <td style={{ padding:'10px 14px', fontWeight:700, color:'var(--navy-700)' }}>{item.code}</td>
                              <td style={{ padding:'10px 14px', paddingLeft: 14 + levelIndent[item.level] }}>
                                <span style={levelStyle[item.level]}>{item.description}</span>
                              </td>
                              <td style={{ padding:'10px 14px', textAlign:'center', fontWeight:600 }}>{item.weight?.toFixed(2) || '—'}%</td>
                              <td style={{ padding:'10px 14px', textAlign:'center', color:'var(--navy-600)', fontWeight:600 }}>
                                {hasSchedule ? `—` : '—'}
                              </td>
                              <td style={{ padding:'10px 14px', textAlign:'center', color:'var(--orange-600)', fontWeight:600 }}>
                                {totalPct > 0 ? `${totalPct.toFixed(1)}%` : '—'}
                              </td>
                              <td style={{ padding:'10px 14px', textAlign:'center' }}>—</td>
                              <td style={{ padding:'10px 14px', textAlign:'center' }}>
                                <span style={{ fontSize:11, fontWeight:600, color:statusColor, background:`${statusColor}15`, padding:'3px 8px', borderRadius:99 }}>
                                  {status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </motion.div>
          )}
        
          </AnimatePresence>
{editingItem && (
            <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div className="card" style={{ width: 400, padding: 24 }}>
                <h3 style={{ marginTop:0, color:'var(--navy-800)' }}>Edit Item BOQ</h3>
                <form onSubmit={saveItemEdit} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600 }}>Kode</label>
                    <input type="text" className="form-input" value={editingItem.code || ''} onChange={e => setEditingItem({...editingItem, code: e.target.value})} required />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600 }}>Uraian Pekerjaan</label>
                    <textarea className="form-input" rows={3} value={editingItem.description || ''} onChange={e => setEditingItem({...editingItem, description: e.target.value})} required />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600 }}>Total Price (Rp)</label>
                    <input type="number" className="form-input" value={editingItem.totalPrice || ''} onChange={e => setEditingItem({...editingItem, totalPrice: e.target.value})} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'flex-end', gap: 8, marginTop: 12 }}>
                    <button type="button" className="btn btn-outline" onClick={() => setEditingItem(null)}>Batal</button>
                    <button type="submit" className="btn btn-primary">Simpan</button>
                  </div>
                </form>
              </div>
            </div>
          )}
{isAddingItem && (
            <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div className="card" style={{ width: 400, padding: 24 }}>
                <h3 style={{ marginTop:0, color:'var(--navy-800)' }}>Tambah Item Baru</h3>
                <form onSubmit={saveNewItem} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600 }}>Kode / Nomor</label>
                    <input type="text" className="form-input" value={newItem.code} onChange={e => setNewItem({...newItem, code: e.target.value})} placeholder="Misal: A.8" required />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600 }}>Uraian Pekerjaan</label>
                    <textarea className="form-input" rows={3} value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} placeholder="Deskripsi pekerjaan" required />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600 }}>Total Price (Rp)</label>
                    <input type="number" className="form-input" value={newItem.totalPrice} onChange={e => setNewItem({...newItem, totalPrice: e.target.value})} placeholder="0" />
                  </div>
                  <div style={{ display:'flex', justifyContent:'flex-end', gap: 8, marginTop: 12 }}>
                    <button type="button" className="btn btn-outline" onClick={() => setIsAddingItem(false)}>Batal</button>
                    <button type="submit" className="btn btn-primary">Tambahkan</button>
                  </div>
                </form>
              </div>
            </div>
          )}
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
