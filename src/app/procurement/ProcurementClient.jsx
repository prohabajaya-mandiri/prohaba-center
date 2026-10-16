'use client';
import { apiFetch, businessToday } from '@/lib/client-api';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Plus, Info, Eye, PackageCheck } from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';
import { EmptyRow, Modal, StatusBadge } from '@/components/ui';
import { idr, fmtDate } from '@/lib/ui-labels';

const itemsOf = (mr) => (mr ? mr.items.map((item) => ({ ...item, unitPrice: 0 })) : []);

export default function ProcurementClient({ purchaseOrders, materialRequests, vendors, user }) {
  const router = useRouter();
  const [receipt, setReceipt] = useState(null);
  const [receiptError, setReceiptError] = useState('');
  const [detail, setDetail] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedMR, setSelectedMR] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [poItems, setPoItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showAlert } = useDialog();
  const canManage = ['TOP_MANAGEMENT', 'LOGISTIK'].includes(user.role);

  const openForm = () => {
    const first = materialRequests[0] ?? null;
    setSelectedMR(first);
    setPoItems(itemsOf(first));
    setSelectedVendor('');
    setDeliveryNotes('');
    setShowForm(true);
  };

  const handleMRChange = (mrId) => {
    const mr = materialRequests.find((m) => m.id === mrId) ?? null;
    setSelectedMR(mr);
    setPoItems(itemsOf(mr));
  };

  const handlePriceChange = (index, price) => {
    setPoItems((prev) => prev.map((it, i) => (i === index ? { ...it, unitPrice: parseFloat(price) || 0 } : it)));
  };

  const total = poItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMR || !selectedVendor) {
      await showAlert('Pilih material request dan vendor terlebih dahulu.', 'Peringatan');
      return;
    }
    if (poItems.some((i) => i.unitPrice <= 0)) {
      await showAlert('Setiap item harus memiliki harga satuan lebih dari 0.', 'Peringatan');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiFetch('/api/procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mrId: selectedMR.id,
          vendorId: selectedVendor,
          notes: deliveryNotes,
          items: poItems.map((item) => ({ mrItemId: item.id, unitPrice: item.unitPrice })),
        }),
      });
      setShowForm(false);
      router.refresh();
      await showAlert('Purchase order berhasil diterbitkan.', 'Berhasil');
    } catch (error) {
      await showAlert(error.message, 'Gagal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitReceipt = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setReceiptError('');
    try {
      const form = new FormData(e.currentTarget);
      const items = receipt.items.map((i) => ({ id: i.id, quantity: Number(form.get(i.id) || 0) })).filter((i) => i.quantity > 0);
      if (!items.length) throw new Error('Isi jumlah diterima untuk minimal satu item.');
      await apiFetch('/api/procurement/' + receipt.id + '/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: form.get('reference'), receivedAt: form.get('receivedAt'), items }),
      });
      setReceipt(null);
      router.refresh();
      await showAlert('Penerimaan barang tersimpan.', 'Berhasil');
    } catch (err) {
      setReceiptError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="stack">
      {canManage && (
        <div className="toolbar">
          <p className="muted" style={{ flex: '1 1 300px', fontSize: 14 }}>
            Terbitkan purchase order dari material request yang sudah disetujui, lalu catat penerimaan barangnya.
          </p>
          <button
            className="btn btn-primary"
            onClick={openForm}
            disabled={!materialRequests.length}
            title={!materialRequests.length ? 'Belum ada material request yang disetujui' : undefined}
          >
            <Plus aria-hidden /> Buat PO dari MR
          </button>
        </div>
      )}

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>No. PO</th>
                <th>Proyek</th>
                <th>Vendor</th>
                <th className="num">Total nilai</th>
                <th>Status</th>
                <th>Ref. MR</th>
                <th>Tanggal</th>
                <th className="num">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.length === 0 ? (
                <EmptyRow colSpan={8} title="Belum ada purchase order" hint={canManage ? 'Klik "Buat PO dari MR" untuk menerbitkan.' : undefined} />
              ) : purchaseOrders.map((po) => (
                <tr key={po.id}>
                  <td className="cell-title nowrap">{po.poNumber}</td>
                  <td>{po.project.code}</td>
                  <td>{po.vendor.name}</td>
                  <td className="num" style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{idr(po.totalAmount)}</td>
                  <td><StatusBadge value={po.status} /></td>
                  <td>{po.mr?.mrNumber || '-'}</td>
                  <td className="nowrap">{fmtDate(po.createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-sm btn-outline" onClick={() => setDetail(po)}><Eye aria-hidden /> Detail</button>
                      {canManage && ['CREATED', 'SENT', 'CONFIRMED', 'PARTIAL'].includes(po.status) && (
                        <button className="btn btn-sm btn-primary" onClick={() => { setReceipt(po); setReceiptError(''); }}>
                          <PackageCheck aria-hidden /> Terima barang
                        </button>
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
          title="Buat purchase order"
          subtitle="Pilih material request yang sudah disetujui, vendor, dan harga per item."
          onClose={() => setShowForm(false)}
          busy={isSubmitting}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)} disabled={isSubmitting}>Batal</button>
              <button type="submit" form="po-form" className="btn btn-primary" disabled={!selectedMR || isSubmitting}>
                <ShoppingCart aria-hidden /> {isSubmitting ? 'Menerbitkan…' : 'Terbitkan PO'}
              </button>
            </>
          }
        >
          <form id="po-form" className="form-stack" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="po-mr">Sumber material request</label>
                <select id="po-mr" className="form-select" value={selectedMR?.id || ''} onChange={(e) => handleMRChange(e.target.value)} required>
                  {materialRequests.map((mr) => <option key={mr.id} value={mr.id}>{mr.mrNumber} — {mr.project.code}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="po-vendor">Vendor</label>
                <select id="po-vendor" className="form-select" value={selectedVendor} onChange={(e) => setSelectedVendor(e.target.value)} required>
                  <option value="">Pilih vendor</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.code})</option>)}
                </select>
                {!vendors.length && <div className="form-hint">Belum ada vendor aktif. Tambahkan di Master Data → Pemasok.</div>}
              </div>
            </div>

            {selectedMR && (
              <div className="form-group">
                <span className="form-label required">Harga per item</span>
                <div className="table-wrapper" style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Barang</th>
                        <th>Satuan</th>
                        <th className="num">Kuantitas</th>
                        <th>Harga satuan (Rp)</th>
                        <th className="num">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poItems.map((item, index) => (
                        <tr key={item.id ?? index}>
                          <td style={{ fontWeight: 500, color: 'var(--gray-900)' }}>{item.description}</td>
                          <td>{item.unit}</td>
                          <td className="num">{Number(item.quantity).toLocaleString('id-ID')}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <input type="number" min="0" className="form-input" aria-label={`Harga satuan ${item.description}`} style={{ width: 160 }} value={item.unitPrice || ''} onChange={(e) => handlePriceChange(index, e.target.value)} />
                          </td>
                          <td className="num" style={{ fontWeight: 600 }}>{idr(item.quantity * item.unitPrice)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={4} className="num" style={{ fontWeight: 600 }}>Total</td>
                        <td className="num" style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{idr(total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="po-notes">Catatan pengiriman</label>
              <textarea id="po-notes" className="form-input" rows="3" value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} />
            </div>

            <p className="alert alert-info"><Info aria-hidden /> Nilai PO dihitung dari kuantitas material request dikali harga satuan.</p>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal
          size="modal-lg"
          title={`Purchase order ${detail.poNumber}`}
          subtitle={`${detail.project.code} · ${detail.vendor.name} · ${fmtDate(detail.createdAt)}`}
          onClose={() => setDetail(null)}
          footer={<button className="btn btn-outline" onClick={() => setDetail(null)}>Tutup</button>}
        >
          <div className="table-wrapper" style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)' }}>
            <table>
              <thead>
                <tr><th>Barang</th><th className="num">Dipesan</th><th className="num">Diterima</th><th>Satuan</th></tr>
              </thead>
              <tbody>
                {detail.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.description}</td>
                    <td className="num">{Number(i.quantity).toLocaleString('id-ID')}</td>
                    <td className="num" style={{ color: i.deliveredQty >= i.quantity ? 'var(--green-700)' : undefined }}>{Number(i.deliveredQty).toLocaleString('id-ID')}</td>
                    <td>{i.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {receipt && (
        <Modal
          title={`Penerimaan barang — ${receipt.poNumber}`}
          subtitle={`${receipt.vendor.name} · ${receipt.project.code}`}
          onClose={() => setReceipt(null)}
          busy={isSubmitting}
          footer={
            <>
              <button type="button" className="btn btn-outline" disabled={isSubmitting} onClick={() => setReceipt(null)}>Batal</button>
              <button type="submit" form="receipt-form" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan…' : 'Simpan penerimaan'}</button>
            </>
          }
        >
          <form id="receipt-form" className="form-stack" onSubmit={submitReceipt}>
            {receiptError && <p role="alert" className="alert alert-danger">{receiptError}</p>}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="rc-ref">No. surat jalan / bukti</label>
                <input id="rc-ref" name="reference" className="form-input" required maxLength={200} />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="rc-date">Tanggal diterima</label>
                <input id="rc-date" name="receivedAt" type="date" className="form-input" defaultValue={businessToday()} required />
              </div>
            </div>
            <div className="form-group">
              <span className="form-label">Jumlah diterima per item</span>
              <div className="form-stack" style={{ gap: 10 }}>
                {receipt.items.filter((i) => i.quantity > i.deliveredQty).map((i) => (
                  <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <label htmlFor={'rc-' + i.id} style={{ flex: '1 1 220px', fontSize: 14 }}>
                      {i.description}
                      <span className="cell-sub" style={{ display: 'block' }}>sisa {i.quantity - i.deliveredQty} {i.unit}</span>
                    </label>
                    <input id={'rc-' + i.id} name={i.id} type="number" className="form-input" style={{ width: 150 }} min="0" max={i.quantity - i.deliveredQty} step="0.001" defaultValue={i.quantity - i.deliveredQty} />
                  </div>
                ))}
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
