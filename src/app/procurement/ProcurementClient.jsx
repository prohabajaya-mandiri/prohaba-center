'use client';
import { apiFetch } from '@/lib/client-api';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Plus, CheckCircle, Clock, Truck, FileText, FileSignature, Info } from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';

export default function ProcurementClient({ purchaseOrders, materialRequests, vendors, user }) {
  const router = useRouter();
  const [receipt,setReceipt]=useState(null),[receiptError,setReceiptError]=useState('');
  const [activeTab, setActiveTab] = useState('list');
  const [selectedMR, setSelectedMR] = useState(materialRequests[0] || null);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [poItems, setPoItems] = useState(
    materialRequests[0] ? materialRequests[0].items.map(item => ({ ...item, unitPrice: 0 })) : []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { showAlert } = useDialog();

  const handleMRChange = (mrId) => {
    const mr = materialRequests.find(m => m.id === mrId);
    setSelectedMR(mr);
    if (mr) {
      setPoItems(mr.items.map(item => ({ ...item, unitPrice: 0 })));
    } else {
      setPoItems([]);
    }
  };

  const handlePriceChange = (index, price) => {
    const newItems = [...poItems];
    newItems[index].unitPrice = parseFloat(price) || 0;
    setPoItems(newItems);
  };

  const handleSubmit = async () => {
    if (!selectedMR || !selectedVendor) {
      await showAlert('Pilih MR dan Vendor', 'Peringatan');
      return;
    }
    
    // Check if any unit price is 0
    if (poItems.some(i => i.unitPrice <= 0)) {
      await showAlert('Semua item harus memiliki estimasi harga satuan lebih dari 0.', 'Peringatan');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        mrId: selectedMR.id,
        vendorId: selectedVendor,
        notes: deliveryNotes,
        items: poItems.map(item => ({
          mrItemId: item.id,
          unitPrice: item.unitPrice
        }))
      };

      const res = await apiFetch('/api/procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menerbitkan PO');
      }

      await showAlert('Purchase Order berhasil diterbitkan!', 'Sukses');
      setActiveTab('list');
      setSelectedMR(null);
      setSelectedVendor('');
      setDeliveryNotes('');
      setPoItems([]);
      router.refresh();
    } catch (error) {
      await showAlert(error.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CREATED': return <span className="badge badge-gray">Draft</span>;
      case 'SENT': return <span className="badge badge-info"><FileSignature size={12} className="mr-1 inline" /> Terkirim ke Vendor</span>;
      case 'CONFIRMED': return <span className="badge badge-primary"><CheckCircle size={12} className="mr-1 inline" /> Dikonfirmasi</span>;
      case 'DELIVERED': return <span className="badge badge-success"><Truck size={12} className="mr-1 inline" /> Terkirim ke Site</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <>
      {receipt&&<div role="dialog" aria-modal="true" style={{position:'fixed',inset:0,background:'#0008',zIndex:9999,display:'grid',placeItems:'center',padding:20}}><form className="card" style={{padding:24,width:'min(600px,100%)',display:'grid',gap:12}} onSubmit={async e=>{e.preventDefault();setIsSubmitting(true);setReceiptError('');try{const form=new FormData(e.currentTarget);await apiFetch('/api/procurement/'+receipt.id+'/receive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference:form.get('reference'),receivedAt:form.get('receivedAt'),items:receipt.items.map(i=>({id:i.id,quantity:Number(form.get(i.id)||0)})).filter(i=>i.quantity>0)})});setReceipt(null);router.refresh();}catch(err){setReceiptError(err.message);}finally{setIsSubmitting(false);}}}><h2>Penerimaan {receipt.poNumber}</h2>{receiptError&&<p role="alert">{receiptError}</p>}<label>Referensi bukti<input name="reference" className="form-input" required maxLength={200}/></label><label>Tanggal<input name="receivedAt" type="date" className="form-input" defaultValue={new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar'}).format(new Date())} required/></label>{receipt.items.filter(i=>i.quantity>i.deliveredQty).map(i=><label key={i.id}>{i.description} (sisa {i.quantity-i.deliveredQty} {i.unit})<input name={i.id} type="number" className="form-input" min="0" max={i.quantity-i.deliveredQty} step="0.001" defaultValue={i.quantity-i.deliveredQty}/></label>)}<div><button className="btn btn-primary" disabled={isSubmitting}>Simpan penerimaan</button> <button type="button" className="btn btn-outline" disabled={isSubmitting} onClick={()=>setReceipt(null)}>Batal</button></div></form></div>}
      <div className="tabs">
        <button className={`tab ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
          <FileText size={16} className="inline-block mr-2" />
          Daftar Purchase Order
        </button>
        {['TOP_MANAGEMENT','LOGISTIK'].includes(user.role) && (
          <button className={`tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>
            <Plus size={16} className="inline-block mr-2" />
            Buat PO dari MR
          </button>
        )}
      </div>

      {activeTab === 'list' && (
        <div className="card">
          <div className="card-body p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>No. PO</th>
                  <th>Proyek</th>
                  <th>Vendor</th>
                  <th>Total Nilai</th>
                  <th>Status</th>
                  <th>Referensi MR</th>
                  <th>Tanggal</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-500">Belum ada Purchase Order.</td></tr>
                ) : (
                  purchaseOrders.map(po => (
                    <tr key={po.id}>
                      <td style={{ fontWeight: 700, color: 'var(--navy-700)' }}>{po.poNumber}</td>
                      <td>{po.project.code}</td>
                      <td>{po.vendor.name}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(po.totalAmount)}</td>
                      <td>{getStatusBadge(po.status)}</td>
                      <td style={{ fontSize: 13, color: 'var(--gray-600)' }}>{po.mr?.mrNumber || '-'}</td>
                      <td style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{new Date(po.createdAt).toLocaleDateString('id-ID')}</td>
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={()=>showAlert(po.items.map(i=>i.description+' — '+i.quantity+' '+i.unit+' (diterima '+i.deliveredQty+')').join('\n'),'Detail PO')}>Detail</button>{['TOP_MANAGEMENT','LOGISTIK'].includes(user.role)&&['CREATED','SENT','CONFIRMED','PARTIAL'].includes(po.status)&&<button className="btn btn-sm btn-primary" onClick={()=>{setReceipt(po);setReceiptError('');}}>Catat penerimaan</button>}
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
            <div className="card-title">Buat Purchase Order Baru</div>
          </div>
          <div className="card-body">
            <div className="alert alert-info">
              <Info size={16} style={{ flexShrink: 0 }} />
              Pilih Material Request yang disetujui untuk konversi menjadi Purchase Order.
            </div>

            <div className="form-grid" style={{ marginBottom: 20 }}>
              <div className="form-group">
                <label className="form-label required">Sumber MR</label>
                <select className="form-input form-select" value={selectedMR?.id || ''} onChange={e => handleMRChange(e.target.value)}>
                  {materialRequests.length === 0 && <option value="">-- Tidak ada MR siap proses --</option>}
                  {materialRequests.map(mr => (
                    <option key={mr.id} value={mr.id}>{mr.mrNumber} - {mr.project.code}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required">Pilih Vendor</label>
                <select className="form-input form-select" value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)}>
                  <option value="">-- Pilih Vendor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedMR && (
              <div style={{ marginBottom: 20 }}>
                <label className="form-label required">Item untuk dipesan</label>
                <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table className="table">
                    <thead style={{ background: 'var(--gray-50)' }}>
                      <tr>
                        <th>Deskripsi Barang</th>
                        <th>Satuan</th>
                        <th>Kuantitas</th>
                        <th>Estimasi Harga</th>
                        <th>Total Harga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poItems.map((item, index) => (
                        <tr key={index}>
                          <td style={{ fontWeight: 500 }}>{item.description}</td>
                          <td>{item.unit}</td>
                          <td style={{ fontWeight: 600 }}>{item.quantity}</td>
                          <td>
                            <input 
                              type="number" 
                              className="form-input" 
                              placeholder="Rp..." 
                              value={item.unitPrice || ''}
                              onChange={e => handlePriceChange(index, e.target.value)}
                            />
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: 'var(--gray-500)' }}>
                              {formatCurrency(item.quantity * item.unitPrice)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Catatan Pengiriman</label>
              <textarea className="form-input" rows="3" placeholder="Catatan pengiriman..." value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)}></textarea>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button className="btn btn-outline" onClick={() => setActiveTab('list')}>Batal</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={materialRequests.length === 0 || isSubmitting}>
                <ShoppingCart size={16} className="inline-block mr-2" />
                {isSubmitting ? 'Menerbitkan...' : 'Terbitkan PO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
