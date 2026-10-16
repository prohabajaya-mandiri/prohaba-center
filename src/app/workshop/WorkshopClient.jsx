'use client';
import { apiFetch, businessToday } from '@/lib/client-api';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wrench, Plus, Check, Printer, Scissors, Truck, Trash2, PackageCheck } from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';
import { EmptyRow, Modal, PrintDoc, SearchField, StatusBadge, printDocument } from '@/components/ui';
import { fmtDate } from '@/lib/ui-labels';

const ORDER_LABELS = { COMPLETED: 'Selesai fabrikasi', DELIVERED: 'Terkirim' };
const TABS = [
  ['orders', 'Surat perintah kerja', Wrench],
  ['cutting', 'Daftar potong', Scissors],
  ['delivery', 'Surat jalan', Truck],
];
const CUT_NEXT = { PENDING: ['CUT', 'Tandai selesai potong'], CUT: ['WELDED', 'Tandai selesai las'], WELDED: ['FINISHED', 'Tandai selesai'] };

export default function WorkshopClient({ initialOrders, projects }) {
  const router = useRouter();
  const orders = useMemo(() => initialOrders || [], [initialOrders]);
  const [activeTab, setActiveTab] = useState('orders');
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('ALL');
  const [modal, setModal] = useState(null); // 'order' | 'cutting' | 'delivery'
  const [submitting, setSubmitting] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [printDoc, setPrintDoc] = useState(null);
  const { showAlert, showConfirm } = useDialog();

  const [orderForm, setOrderForm] = useState({ projectId: '', description: '', startDate: '', endDate: '' });
  const [cuttingForm, setCuttingForm] = useState({ fabricationOrderId: '', materialName: '', dimensions: '', quantity: 1 });
  const [deliveryForm, setDeliveryForm] = useState({ fabricationOrderId: '', driverName: '', vehicleNumber: '', deliveryDate: businessToday() });

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchProject = filterProject === 'ALL' || o.projectId === filterProject;
      return matchProject && (!q || o.orderNumber.toLowerCase().includes(q) || o.description.toLowerCase().includes(q)
        || o.cuttingLists?.some((c) => c.materialName.toLowerCase().includes(q))
        || o.deliveries?.some((d) => d.ticketNumber.toLowerCase().includes(q)));
    });
  }, [orders, search, filterProject]);

  const cuttingRows = filteredOrders.flatMap((o) => (o.cuttingLists ?? []).map((c) => ({ ...c, order: o })));
  const deliveryRows = filteredOrders.flatMap((o) => (o.deliveries ?? []).map((d) => ({ ...d, order: o })));

  const post = async (url, method, body, success) => {
    setSubmitting(true);
    try {
      await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      setModal(null);
      router.refresh();
      if (success) await showAlert(success, 'Berhasil');
      return true;
    } catch (err) {
      await showAlert(err.message, 'Gagal');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOrder = (e) => {
    e.preventDefault();
    if (orderForm.startDate && orderForm.endDate && orderForm.endDate < orderForm.startDate) {
      showAlert('Tanggal selesai tidak boleh sebelum tanggal mulai.', 'Periksa kembali');
      return;
    }
    post('/api/workshop/orders', 'POST', orderForm, 'Order fabrikasi dibuat.');
  };
  const handleCreateCuttingList = (e) => { e.preventDefault(); post('/api/workshop/cutting-list', 'POST', cuttingForm, 'Item potong ditambahkan.'); };
  const handleCreateDelivery = (e) => { e.preventDefault(); post('/api/workshop/deliveries', 'POST', deliveryForm, 'Surat jalan dibuat. Cetak dari tab Surat jalan.'); };

  const updateOrderStatus = (o, status) => post(`/api/workshop/orders/${o.id}`, 'PATCH', { status });
  const updateCuttingStatus = (c, status) => post(`/api/workshop/cutting-list/${c.id}`, 'PATCH', { status });

  const deleteItem = async (type, id, label) => {
    if (!(await showConfirm(`Hapus ${label}? Tindakan ini tidak dapat dibatalkan.`, 'Hapus data'))) return;
    post(`/api/workshop/${type}/${id}`, 'DELETE');
  };

  const receiveDelivery = async (d) => {
    if (!(await showConfirm(`Konfirmasi surat jalan ${d.ticketNumber} sudah diterima di site?`, 'Terima di site'))) return;
    post('/api/workshop/deliveries/' + d.id, 'PATCH', { status: 'RECEIVED_AT_SITE' });
  };

  const openOrderModal = () => {
    setOrderForm({ projectId: projects[0]?.id || '', description: '', startDate: '', endDate: '' });
    setModal('order');
  };
  const openCuttingModal = (order) => {
    setSelectedOrder(order);
    setCuttingForm({ fabricationOrderId: order.id, materialName: '', dimensions: '', quantity: 1 });
    setModal('cutting');
  };
  const openDeliveryModal = (order) => {
    setSelectedOrder(order);
    setDeliveryForm({ fabricationOrderId: order.id, driverName: '', vehicleNumber: '', deliveryDate: businessToday() });
    setModal('delivery');
  };

  const printSJ = (ticket, order) => {
    setPrintDoc({ ticket, order });
    printDocument();
  };

  const modalFooter = (formId, label) => (
    <>
      <button type="button" className="btn btn-outline" onClick={() => setModal(null)} disabled={submitting}>Batal</button>
      <button type="submit" form={formId} className="btn btn-primary" disabled={submitting}>{submitting ? 'Menyimpan…' : label}</button>
    </>
  );

  return (
    <div className="stack">
      <div className="toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="Cari nomor order, material, atau surat jalan" />
        <select className="form-select" aria-label="Filter proyek" style={{ width: 220, flex: '0 1 220px' }} value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
          <option value="ALL">Semua proyek</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
        </select>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={openOrderModal} disabled={!projects.length}>
          <Plus aria-hidden /> Order fabrikasi
        </button>
      </div>

      <div className="card">
        <div className="tabs" role="tablist">
          {TABS.map(([key, label, Icon]) => (
            <button key={key} role="tab" aria-selected={activeTab === key} className={`tab ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>
              <Icon aria-hidden /> {label}
            </button>
          ))}
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              {activeTab === 'orders' && (
                <tr><th>Nomor order</th><th>Proyek</th><th>Deskripsi</th><th>Jadwal</th><th>Status</th><th className="num">Aksi</th></tr>
              )}
              {activeTab === 'cutting' && (
                <tr><th>Order</th><th>Material</th><th>Dimensi</th><th className="num">Jumlah</th><th>Status</th><th className="num">Aksi</th></tr>
              )}
              {activeTab === 'delivery' && (
                <tr><th>Surat jalan</th><th>Order fabrikasi</th><th>Armada & supir</th><th>Tanggal kirim</th><th>Status</th><th className="num">Aksi</th></tr>
              )}
            </thead>
            <tbody>
              {activeTab === 'orders' && (filteredOrders.length === 0 ? <EmptyRow colSpan={6} title="Belum ada order fabrikasi" /> : filteredOrders.map((o) => (
                <tr key={o.id}>
                  <td className="cell-title nowrap">{o.orderNumber}</td>
                  <td>{o.project?.name}</td>
                  <td style={{ minWidth: 200 }}>{o.description}</td>
                  <td className="nowrap">{o.startDate ? fmtDate(o.startDate) : '-'}{o.endDate ? ` – ${fmtDate(o.endDate)}` : ''}</td>
                  <td><StatusBadge value={o.status} labels={ORDER_LABELS} /></td>
                  <td>
                    <div className="row-actions">
                      {o.status === 'PLANNED' && <button className="btn btn-outline btn-sm" disabled={submitting} onClick={() => updateOrderStatus(o, 'IN_PROGRESS')}><Check aria-hidden /> Mulai proses</button>}
                      {o.status === 'IN_PROGRESS' && <button className="btn btn-outline btn-sm" disabled={submitting} onClick={() => updateOrderStatus(o, 'COMPLETED')}><Check aria-hidden /> Selesai fabrikasi</button>}
                      <button className="action-btn" onClick={() => openCuttingModal(o)} title="Tambah item potong" aria-label={`Tambah item potong ${o.orderNumber}`}><Scissors /></button>
                      <button className="action-btn success" disabled={o.status !== 'COMPLETED' || o.deliveries.length > 0} onClick={() => openDeliveryModal(o)} title={o.status !== 'COMPLETED' ? 'Surat jalan dapat dibuat setelah fabrikasi selesai' : 'Buat surat jalan'} aria-label={`Buat surat jalan ${o.orderNumber}`}><Truck /></button>
                      <button className="action-btn danger" onClick={() => deleteItem('orders', o.id, `order ${o.orderNumber}`)} title="Hapus order" aria-label={`Hapus ${o.orderNumber}`}><Trash2 /></button>
                    </div>
                  </td>
                </tr>
              )))}

              {activeTab === 'cutting' && (cuttingRows.length === 0 ? <EmptyRow colSpan={6} title="Belum ada item potong" hint="Tambahkan dari tombol gunting pada tab Surat perintah kerja." /> : cuttingRows.map((c) => (
                <tr key={c.id}>
                  <td className="nowrap">{c.order.orderNumber}</td>
                  <td className="cell-title">{c.materialName}</td>
                  <td>{c.dimensions}</td>
                  <td className="num">{c.quantity} unit</td>
                  <td><StatusBadge value={c.status} /></td>
                  <td>
                    <div className="row-actions">
                      {CUT_NEXT[c.status] && <button className="btn btn-outline btn-sm" disabled={submitting} onClick={() => updateCuttingStatus(c, CUT_NEXT[c.status][0])}><Check aria-hidden /> {CUT_NEXT[c.status][1]}</button>}
                      <button className="action-btn danger" onClick={() => deleteItem('cutting-list', c.id, `item ${c.materialName}`)} title="Hapus item" aria-label={`Hapus ${c.materialName}`}><Trash2 /></button>
                    </div>
                  </td>
                </tr>
              )))}

              {activeTab === 'delivery' && (deliveryRows.length === 0 ? <EmptyRow colSpan={6} title="Belum ada surat jalan" hint="Surat jalan dibuat dari order yang sudah selesai fabrikasi." /> : deliveryRows.map((d) => (
                <tr key={d.id}>
                  <td className="cell-title nowrap">{d.ticketNumber}</td>
                  <td>{d.order.orderNumber}</td>
                  <td>{d.vehicleNumber}<div className="cell-sub">{d.driverName}</div></td>
                  <td className="nowrap">{fmtDate(d.deliveryDate)}</td>
                  <td><StatusBadge value={d.status} /></td>
                  <td>
                    <div className="row-actions">
                      <button className="action-btn" onClick={() => printSJ(d, d.order)} title="Cetak surat jalan" aria-label={`Cetak ${d.ticketNumber}`}><Printer /></button>
                      {d.status === 'IN_TRANSIT' && <button className="btn btn-primary btn-sm" disabled={submitting} onClick={() => receiveDelivery(d)}><PackageCheck aria-hidden /> Terima di site</button>}
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'order' && (
        <Modal title="Order fabrikasi baru" onClose={() => setModal(null)} busy={submitting} footer={modalFooter('order-form', 'Simpan order')}>
          <form id="order-form" onSubmit={handleCreateOrder} className="form-stack">
            <div className="form-group">
              <label className="form-label required" htmlFor="wo-project">Proyek</label>
              <select id="wo-project" className="form-select" value={orderForm.projectId} onChange={(e) => setOrderForm({ ...orderForm, projectId: e.target.value })} required>
                <option value="" disabled>Pilih proyek</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="wo-desc">Deskripsi fabrikasi</label>
              <input id="wo-desc" required className="form-input" value={orderForm.description} onChange={(e) => setOrderForm({ ...orderForm, description: e.target.value })} />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="wo-start">Tanggal mulai</label>
                <input id="wo-start" type="date" className="form-input" value={orderForm.startDate} onChange={(e) => setOrderForm({ ...orderForm, startDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wo-end">Tanggal selesai</label>
                <input id="wo-end" type="date" className="form-input" min={orderForm.startDate || undefined} value={orderForm.endDate} onChange={(e) => setOrderForm({ ...orderForm, endDate: e.target.value })} />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'cutting' && (
        <Modal title="Tambah item potong" subtitle={selectedOrder ? `${selectedOrder.orderNumber} — ${selectedOrder.description}` : undefined} onClose={() => setModal(null)} busy={submitting} footer={modalFooter('cutting-form', 'Simpan item')}>
          <form id="cutting-form" onSubmit={handleCreateCuttingList} className="form-stack">
            <div className="form-group">
              <label className="form-label required" htmlFor="cl-mat">Material</label>
              <input id="cl-mat" required className="form-input" value={cuttingForm.materialName} onChange={(e) => setCuttingForm({ ...cuttingForm, materialName: e.target.value })} />
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
              <div className="form-group">
                <label className="form-label required" htmlFor="cl-dim">Dimensi</label>
                <input id="cl-dim" required className="form-input" placeholder="Panjang / ukuran" value={cuttingForm.dimensions} onChange={(e) => setCuttingForm({ ...cuttingForm, dimensions: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="cl-qty">Jumlah</label>
                <input id="cl-qty" type="number" min="1" required className="form-input" value={cuttingForm.quantity} onChange={(e) => setCuttingForm({ ...cuttingForm, quantity: e.target.value })} />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'delivery' && (
        <Modal title="Buat surat jalan" subtitle={selectedOrder ? `${selectedOrder.orderNumber} — ${selectedOrder.project?.name ?? ''}` : undefined} onClose={() => setModal(null)} busy={submitting} footer={modalFooter('delivery-form', 'Simpan surat jalan')}>
          <form id="delivery-form" onSubmit={handleCreateDelivery} className="form-stack">
            <div className="form-group">
              <label className="form-label required" htmlFor="dl-driver">Nama supir</label>
              <input id="dl-driver" required className="form-input" value={deliveryForm.driverName} onChange={(e) => setDeliveryForm({ ...deliveryForm, driverName: e.target.value })} />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="dl-plate">No. kendaraan (plat)</label>
                <input id="dl-plate" required className="form-input" value={deliveryForm.vehicleNumber} onChange={(e) => setDeliveryForm({ ...deliveryForm, vehicleNumber: e.target.value.toUpperCase() })} />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="dl-date">Tanggal kirim</label>
                <input id="dl-date" type="date" required className="form-input" value={deliveryForm.deliveryDate} onChange={(e) => setDeliveryForm({ ...deliveryForm, deliveryDate: e.target.value })} />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {printDoc && (
        <PrintDoc>
          <div className="print-doc-head">
            <div className="print-doc-brand">
              <img src="/brand/prohaba-logo.png" alt="" />
              <div>
                <strong>PT. Prohaba Jaya Mandiri</strong>
                <div>Divisi Fabrikasi & Workshop</div>
              </div>
            </div>
            <div className="print-doc-title">
              <h1>SURAT JALAN</h1>
              <p>{printDoc.ticket.ticketNumber}</p>
            </div>
          </div>

          <div className="print-doc-parties">
            <div>
              <div className="print-doc-label">Tujuan pengiriman</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Proyek {printDoc.order.project?.name}</div>
              <div>Order fabrikasi: {printDoc.order.orderNumber}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="print-doc-label">Tanggal kirim</div>
              <div>{fmtDate(printDoc.ticket.deliveryDate, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div className="print-doc-label" style={{ marginTop: 8 }}>Armada</div>
              <div>{printDoc.ticket.vehicleNumber} ({printDoc.ticket.driverName})</div>
            </div>
          </div>

          <table>
            <thead>
              <tr><th>Barang / keterangan</th><th className="num">Kuantitas</th></tr>
            </thead>
            <tbody>
              <tr><td>Material / struktur baja sesuai Surat Perintah Kerja {printDoc.order.orderNumber} — {printDoc.order.description}</td><td className="num">1 lot</td></tr>
            </tbody>
          </table>

          <div className="print-doc-signs">
            <div><div>Penerima (site),</div><div className="line" /><div>Nama terang</div></div>
            <div><div>Supir,</div><div className="line" /><div>{printDoc.ticket.driverName}</div></div>
            <div><div>Pengirim (workshop),</div><div className="line" /><div>Admin workshop</div></div>
          </div>
        </PrintDoc>
      )}
    </div>
  );
}
