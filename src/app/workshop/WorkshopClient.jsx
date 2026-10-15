'use client';
import { businessToday } from '@/lib/client-api';
import { apiFetch } from '@/lib/client-api';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wrench, Search, Plus, FileText, Check, X, Printer, 
  XCircle, AlertCircle, Scissors, Truck, ChevronRight
} from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';

export default function WorkshopClient({ initialOrders, projects }) {
  const [orders, setOrders] = useState(initialOrders || []);
  const [activeTab, setActiveTab] = useState('orders'); // orders, cutting, delivery
  
  // States for search and filter
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('ALL');
  
  // Modal States
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCuttingModalOpen, setIsCuttingModalOpen] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const { showAlert, showConfirm } = useDialog();

  // Form Data
  const [orderForm, setOrderForm] = useState({
    projectId: '', description: '', startDate: '', endDate: ''
  });
  
  const [cuttingForm, setCuttingForm] = useState({
    fabricationOrderId: '', materialName: '', dimensions: '', quantity: 1
  });
  
  const [deliveryForm, setDeliveryForm] = useState({
    fabricationOrderId: '', driverName: '', vehicleNumber: '', deliveryDate: businessToday()
  });

  const [printDoc, setPrintDoc] = useState(null);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch = o.orderNumber.toLowerCase().includes(search.toLowerCase()) || 
                          o.description.toLowerCase().includes(search.toLowerCase());
      const matchProject = filterProject === 'ALL' || o.projectId === filterProject;
      return matchSearch && matchProject;
    });
  }, [orders, search, filterProject]);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/workshop/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderForm)
      });
      if (!res.ok) throw new Error('Gagal membuat Order Fabrikasi');
      setIsOrderModalOpen(false);
      window.location.reload();
    } catch (err) {
      await showAlert(err.message, 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCuttingList = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/workshop/cutting-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuttingForm)
      });
      if (!res.ok) throw new Error('Gagal menambahkan item potong');
      setIsCuttingModalOpen(false);
      window.location.reload();
    } catch (err) {
      await showAlert(err.message, 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDelivery = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/workshop/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deliveryForm)
      });
      if (!res.ok) throw new Error('Gagal mencetak Surat Jalan');
      setIsDeliveryModalOpen(false);
      window.location.reload();
    } catch (err) {
      await showAlert(err.message, 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateOrderStatus = async (id, status) => {
    try {
      await apiFetch(`/api/workshop/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      window.location.reload();
    } catch (err) {
      await showAlert('Gagal memperbarui status', 'Error');
    }
  };

  const updateCuttingStatus = async (id, status) => {
    try {
      await apiFetch(`/api/workshop/cutting-list/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      window.location.reload();
    } catch (err) {
      await showAlert('Gagal memperbarui status', 'Error');
    }
  };

  const deleteItem = async (type, id) => {
    const confirmed = await showConfirm('Hapus data ini?', 'Konfirmasi');
    if (!confirmed) return;
    try {
      await apiFetch(`/api/workshop/${type}/${id}`, { method: 'DELETE' });
      window.location.reload();
    } catch (err) {
      await showAlert('Gagal menghapus', 'Error');
    }
  };

  const openCuttingModal = (order) => {
    setSelectedOrder(order);
    setCuttingForm({ fabricationOrderId: order.id, materialName: '', dimensions: '', quantity: 1 });
    setIsCuttingModalOpen(true);
  };

  const openDeliveryModal = (order) => {
    setSelectedOrder(order);
    setDeliveryForm({ fabricationOrderId: order.id, driverName: '', vehicleNumber: '', deliveryDate: businessToday() });
    setIsDeliveryModalOpen(true);
  };

  const printSJ = (ticket, order) => {
    setPrintDoc({ type: 'SJ', ticket, order });
    setTimeout(() => { window.print(); }, 100);
  };

  const getOrderStatusBadge = (status) => {
    const s = {
      'PLANNED': 'badge-neutral',
      'IN_PROGRESS': 'badge-warning',
      'COMPLETED': 'badge-info',
      'DELIVERED': 'badge-success'
    };
    return <span className={`badge ${s[status] || 'badge-neutral'}`} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>{status}</span>;
  };

  const getCuttingStatusBadge = (status) => {
    const s = {
      'PENDING': 'badge-neutral',
      'CUT': 'badge-warning',
      'WELDED': 'badge-info',
      'FINISHED': 'badge-success'
    };
    return <span className={`badge ${s[status] || 'badge-neutral'}`} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>{status}</span>;
  };

  return (
    <motion.div 
      style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--gray-200)', paddingBottom: '8px' }}>
        <button className={`btn-ghost ${activeTab === 'orders' ? 'active-tab' : ''}`} style={{ fontWeight: activeTab === 'orders' ? 700 : 500, color: activeTab === 'orders' ? 'var(--blue-600)' : 'var(--gray-500)', borderBottom: activeTab === 'orders' ? '2px solid var(--blue-600)' : 'none', padding: '8px 16px', borderRadius: '0' }} onClick={() => setActiveTab('orders')}>
          <Wrench size={16} style={{ display: 'inline', marginRight: '6px' }}/> Surat Perintah Kerja
        </button>
        <button className={`btn-ghost ${activeTab === 'cutting' ? 'active-tab' : ''}`} style={{ fontWeight: activeTab === 'cutting' ? 700 : 500, color: activeTab === 'cutting' ? 'var(--blue-600)' : 'var(--gray-500)', borderBottom: activeTab === 'cutting' ? '2px solid var(--blue-600)' : 'none', padding: '8px 16px', borderRadius: '0' }} onClick={() => setActiveTab('cutting')}>
          <Scissors size={16} style={{ display: 'inline', marginRight: '6px' }}/> Daftar Potong
        </button>
        <button className={`btn-ghost ${activeTab === 'delivery' ? 'active-tab' : ''}`} style={{ fontWeight: activeTab === 'delivery' ? 700 : 500, color: activeTab === 'delivery' ? 'var(--blue-600)' : 'var(--gray-500)', borderBottom: activeTab === 'delivery' ? '2px solid var(--blue-600)' : 'none', padding: '8px 16px', borderRadius: '0' }} onClick={() => setActiveTab('delivery')}>
          <Truck size={16} style={{ display: 'inline', marginRight: '6px' }}/> Surat Jalan
        </button>
      </div>

      {/* Top Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flex: 1, maxWidth: '600px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{ width: '20px', height: '20px', position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input 
              type="text" 
              placeholder="Cari Data..." 
              className="form-input"
              style={{ paddingLeft: '44px', borderRadius: '12px', background: 'white', height: '44px', width: '100%' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ position: 'relative', width: '200px' }}>
            <select
              className="form-select"
              style={{ height: '44px', borderRadius: '12px', fontWeight: 500, width: '100%' }}
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
            >
              <option value="ALL">Semua Proyek</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code}</option>
              ))}
            </select>
          </div>
        </div>
        {activeTab === 'orders' && (
          <button className="btn btn-primary" style={{ height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { setOrderForm({ projectId: projects[0]?.id || '', description: '', startDate: '', endDate: '' }); setIsOrderModalOpen(true); }}>
            <Plus size={18} /> <span>Order Fabrikasi</span>
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="card" style={{ boxShadow: 'var(--shadow-md)', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table>
            <thead style={{ background: 'var(--gray-50)' }}>
              <tr>
                {activeTab === 'orders' && (
                  <><th>Nomor Order</th><th>Proyek</th><th>Deskripsi</th><th>Tanggal</th><th>Status</th><th style={{ textAlign: 'right' }}>Aksi</th></>
                )}
                {activeTab === 'cutting' && (
                  <><th>Order</th><th>Material</th><th>Dimensi & Qty</th><th>Status</th><th style={{ textAlign: 'right' }}>Aksi</th></>
                )}
                {activeTab === 'delivery' && (
                  <><th>Surat Jalan</th><th>Order Fabrikasi</th><th>Armada & Supir</th><th>Tgl Kirim</th><th>Status</th><th style={{ textAlign: 'right' }}>Aksi</th></>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <FileText size={32} style={{ color: 'var(--gray-400)' }} />
                      <p>Tidak Ada Data</p>
                    </div>
                  </td>
                </tr>
              )}
              
              {/* TAB: ORDERS */}
              {activeTab === 'orders' && filteredOrders.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{o.orderNumber}</td>
                  <td style={{ fontWeight: 600, color: 'var(--navy-800)' }}>{o.project?.name}</td>
                  <td style={{ fontSize: '13px', color: 'var(--gray-700)' }}>{o.description}</td>
                  <td style={{ fontSize: '13px' }}>
                    {o.startDate ? new Date(o.startDate).toLocaleDateString('id-ID') : '-'}
                  </td>
                  <td>{getOrderStatusBadge(o.status)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button className="btn-ghost" style={{ padding: '8px', borderRadius: '8px', color: 'var(--blue-600)' }} onClick={() => openCuttingModal(o)} title="Tambah Cutting List"><Scissors size={18} /></button>
                      <button className="btn-ghost" style={{ padding: '8px', borderRadius: '8px', color: 'var(--green-600)' }} disabled={o.status!=='COMPLETED'||o.deliveries.length>0} onClick={() => openDeliveryModal(o)} title="Kirim / Buat Surat Jalan"><Truck size={18} /></button>
                      {o.status === 'PLANNED' && (
                        <button className="btn-ghost" style={{ padding: '8px', borderRadius: '8px', color: 'var(--blue-600)' }} onClick={() => updateOrderStatus(o.id, 'IN_PROGRESS')} title="Mulai Proses"><Check size={18} /></button>
                      )}
                      {o.status === 'IN_PROGRESS' && (
                        <button className="btn-ghost" style={{ padding: '8px', borderRadius: '8px', color: 'var(--blue-600)' }} onClick={() => updateOrderStatus(o.id, 'COMPLETED')} title="Selesai Fabrikasi"><Check size={18} /></button>
                      )}
                      <button className="btn-ghost" style={{ padding: '8px', borderRadius: '8px', color: 'var(--red-600)' }} onClick={() => deleteItem('orders', o.id)} title="Hapus"><X size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* TAB: CUTTING LIST */}
              {activeTab === 'cutting' && filteredOrders.flatMap(o => o.cuttingLists.map(c => ({...c, order: o}))).map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: '13px' }}>{c.order.orderNumber}</td>
                  <td style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{c.materialName}</td>
                  <td style={{ fontSize: '13px', color: 'var(--gray-700)' }}>{c.dimensions} <span style={{ fontWeight: 600, color: 'var(--gray-900)' }}>({c.quantity} unit)</span></td>
                  <td>{getCuttingStatusBadge(c.status)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      {c.status === 'PENDING' && <button className="btn-ghost" style={{ padding: '8px', borderRadius: '8px', color: 'var(--blue-600)' }} onClick={() => updateCuttingStatus(c.id, 'CUT')} title="Tandai Selesai Potong"><Check size={18} /></button>}
                      {c.status === 'CUT' && <button className="btn-ghost" style={{ padding: '8px', borderRadius: '8px', color: 'var(--blue-600)' }} onClick={() => updateCuttingStatus(c.id, 'WELDED')} title="Tandai Selesai Las"><Check size={18} /></button>}
                      {c.status === 'WELDED' && <button className="btn-ghost" style={{ padding: '8px', borderRadius: '8px', color: 'var(--blue-600)' }} onClick={() => updateCuttingStatus(c.id, 'FINISHED')} title="Selesai"><Check size={18} /></button>}
                      <button className="btn-ghost" style={{ padding: '8px', borderRadius: '8px', color: 'var(--red-600)' }} onClick={() => deleteItem('cutting-list', c.id)} title="Hapus"><X size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* TAB: DELIVERY */}
              {activeTab === 'delivery' && filteredOrders.flatMap(o => o.deliveries.map(d => ({...d, order: o}))).map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{d.ticketNumber}</td>
                  <td style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: '13px' }}>{d.order.orderNumber}</td>
                  <td style={{ fontSize: '13px', color: 'var(--gray-700)' }}>{d.driverName} - {d.vehicleNumber}</td>
                  <td style={{ fontSize: '13px' }}>{new Date(d.deliveryDate).toLocaleDateString('id-ID')}</td>
                  <td><span className="badge badge-neutral" style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>{d.status}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button className="btn-ghost" style={{ padding: '8px', borderRadius: '8px', color: 'var(--blue-600)' }} onClick={() => printSJ(d, d.order)} title="Cetak Surat Jalan"><Printer size={18} /></button>{d.status==='IN_TRANSIT'&&<button className="btn btn-primary" onClick={async()=>{try{await apiFetch('/api/workshop/deliveries/'+d.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'RECEIVED_AT_SITE'})});window.location.reload();}catch(e){await showAlert(e.message,'Gagal');}}}>Terima di site</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Modal */}
      <AnimatePresence>
        {isOrderModalOpen && (
          <motion.div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '500px', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
              <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy-900)' }}>Order Fabrikasi</h3>
                <button onClick={() => setIsOrderModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}><XCircle size={24} /></button>
              </div>
              <form onSubmit={handleCreateOrder} style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label required">Proyek</label>
                  <select className="form-select" style={{ height: '44px', borderRadius: '10px' }} value={orderForm.projectId} onChange={e => setOrderForm({...orderForm, projectId: e.target.value})} required>
                    <option value="" disabled>Pilih Proyek...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label required">Deskripsi Fabrikasi</label>
                  <input type="text" required className="form-input" style={{ height: '44px', borderRadius: '10px' }} value={orderForm.description} onChange={e => setOrderForm({...orderForm, description: e.target.value})} />
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Tanggal Mulai</label>
                    <input type="date" className="form-input" style={{ height: '44px', borderRadius: '10px' }} value={orderForm.startDate} onChange={e => setOrderForm({...orderForm, startDate: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Tanggal Selesai</label>
                    <input type="date" className="form-input" style={{ height: '44px', borderRadius: '10px' }} value={orderForm.endDate} onChange={e => setOrderForm({...orderForm, endDate: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: '10px', fontWeight: 600 }} disabled={submitting}>Simpan</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cutting Modal */}
      <AnimatePresence>
        {isCuttingModalOpen && (
          <motion.div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '500px', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
              <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy-900)' }}>Tambah Item Potong</h3>
                <button onClick={() => setIsCuttingModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}><XCircle size={24} /></button>
              </div>
              <form onSubmit={handleCreateCuttingList} style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label required">Material</label>
                  <input type="text" required className="form-input" style={{ height: '44px', borderRadius: '10px' }} value={cuttingForm.materialName} onChange={e => setCuttingForm({...cuttingForm, materialName: e.target.value})} />
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label required">Dimensi</label>
                    <input type="text" required className="form-input" placeholder="Panjang / Ukuran" style={{ height: '44px', borderRadius: '10px' }} value={cuttingForm.dimensions} onChange={e => setCuttingForm({...cuttingForm, dimensions: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label required">Jumlah</label>
                    <input type="number" min="1" required className="form-input" style={{ height: '44px', borderRadius: '10px' }} value={cuttingForm.quantity} onChange={e => setCuttingForm({...cuttingForm, quantity: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: '10px', fontWeight: 600 }} disabled={submitting}>Simpan</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delivery Modal */}
      <AnimatePresence>
        {isDeliveryModalOpen && (
          <motion.div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '500px', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
              <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy-900)' }}>Buat Surat Jalan</h3>
                <button onClick={() => setIsDeliveryModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}><XCircle size={24} /></button>
              </div>
              <form onSubmit={handleCreateDelivery} style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label required">Nama Supir</label>
                  <input type="text" required className="form-input" style={{ height: '44px', borderRadius: '10px' }} value={deliveryForm.driverName} onChange={e => setDeliveryForm({...deliveryForm, driverName: e.target.value})} />
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label required">No. Kendaraan (Plat)</label>
                    <input type="text" required className="form-input" style={{ height: '44px', borderRadius: '10px' }} value={deliveryForm.vehicleNumber} onChange={e => setDeliveryForm({...deliveryForm, vehicleNumber: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label required">Tanggal Kirim</label>
                    <input type="date" required className="form-input" style={{ height: '44px', borderRadius: '10px' }} value={deliveryForm.deliveryDate} onChange={e => setDeliveryForm({...deliveryForm, deliveryDate: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: '10px', fontWeight: 600 }} disabled={submitting}>Cetak Surat Jalan</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PRINTABLE CSS AND TEMPLATE */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #printable-sj, #printable-sj * { visibility: visible; }
          #printable-sj { position: absolute; left: 0; top: 0; width: 100%; color: black !important; background: white !important; }
        }
      `}} />

      {printDoc && printDoc.type === 'SJ' && (
        <div id="printable-sj" className="hidden print:block p-8 bg-white text-black max-w-4xl mx-auto">
          <div className="flex justify-between items-start border-b border-gray-300 pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">SURAT JALAN</h1>
              <p className="text-gray-500 mt-1">{printDoc.ticket.ticketNumber}</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-semibold">PT. Prohaba Jaya Mandiri</h2>
              <p className="text-sm text-gray-600 mt-1">Divisi Fabrikasi & Workshop</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-sm text-gray-500 font-medium">Tujuan Pengiriman:</p>
              <p className="text-lg font-semibold mt-1">Proyek {printDoc.order.project?.name}</p>
              <p className="text-sm text-gray-600">Order Fabrikasi: {printDoc.order.orderNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 font-medium">Tanggal Kirim:</p>
              <p className="text-base font-medium">{new Date(printDoc.ticket.deliveryDate).toLocaleDateString('id-ID')}</p>
              <p className="text-sm text-gray-500 font-medium mt-2">Armada:</p>
              <p className="text-base font-medium">{printDoc.ticket.vehicleNumber} ({printDoc.ticket.driverName})</p>
            </div>
          </div>

          <table className="w-full text-left mb-8">
            <thead>
              <tr className="border-y border-gray-300">
                <th className="py-3 px-4 font-semibold text-gray-700">Barang / Keterangan</th>
                <th className="py-3 px-4 font-semibold text-gray-700 text-right">Kuantitas</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-4 px-4">Material / Struktur Baja sesuai dengan Surat Perintah Kerja {printDoc.order.orderNumber} - {printDoc.order.description}</td>
                <td className="py-4 px-4 text-right font-medium">1 Lot</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-between items-end mt-24">
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-16">Penerima (Site),</p>
              <div className="border-b border-gray-400 w-40 mb-2"></div>
              <p className="text-sm font-medium">Nama Terang</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-16">Supir,</p>
              <div className="border-b border-gray-400 w-40 mb-2"></div>
              <p className="text-sm font-medium">{printDoc.ticket.driverName}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-16">Pengirim (Workshop),</p>
              <div className="border-b border-gray-400 w-40 mb-2"></div>
              <p className="text-sm font-medium">Admin Workshop</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
