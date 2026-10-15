'use client';
import { businessToday } from '@/lib/client-api';
import { apiFetch } from '@/lib/client-api';

import PaymentDialog from '@/components/PaymentDialog';
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Banknote, Search, Plus, FileText, Check, X, Printer, XCircle, AlertCircle
} from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';

export default function RevenueClient({ invoices, projects, accounts, downPayments }) {
  const [payment, setPayment] = useState(null);
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [printInvoice, setPrintInvoice] = useState(null);
  
  const { showAlert, showConfirm } = useDialog();

  const [formData, setFormData] = useState({
    projectId: '',
    description: '',
    subTotal: '',
    taxRate: '11',
    date: businessToday(),
    dueDate: '',
    category: 'TERMIN',
    downPaymentId: ''
  });

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchSearch = inv.invoiceNo.toLowerCase().includes(search.toLowerCase()) || 
                          inv.description.toLowerCase().includes(search.toLowerCase());
      const matchProject = filterProject === 'ALL' || inv.projectId === filterProject;
      return matchSearch && matchProject;
    });
  }, [invoices, search, filterProject]);

  const downPaymentOptions = useMemo(() => {
    if (!formData.projectId) return [];
    return downPayments.filter(inv => inv.projectId === formData.projectId);
  }, [downPayments, formData.projectId]);

  const formatRupiah = (amount) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
  };

  const handlePrint = (invoice) => {
    setPrintInvoice(invoice);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleOpenModal = () => {
    setFormData({
      projectId: projects[0]?.id || '',
      description: '',
      subTotal: '',
      taxRate: '11',
      date: businessToday(),
      dueDate: '',
      category: 'TERMIN',
      downPaymentId: ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({...formData,downPaymentAmount:formData.downPaymentAmount||undefined})
      });
      if (!res.ok) throw new Error('Gagal menyimpan tagihan');
      
      setIsModalOpen(false);
      window.location.reload();
    } catch (err) {
      await showAlert(err.message, 'Gagal');
      await showAlert(err.message, 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    setPayment(invoices.find(i=>i.id===id));
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm('Batalkan faktur ini dan buat jurnal pembalik? Riwayat tetap disimpan.', 'Batalkan Faktur');
    if (!confirmed) return;
    try {
      await apiFetch(`/api/revenue/${id}`, { method: 'DELETE' });
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'VOID') return <span className="badge">DIBATALKAN</span>;
    if (status === 'PAID') return <span className="badge badge-success" style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>LUNAS</span>;
    if (status === 'PARTIAL') return <span className="badge badge-warning" style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>SEBAGIAN</span>;
    return <span className="badge badge-danger" style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>BELUM BAYAR</span>;
  };

  return (
    <motion.div 
      style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {payment&&<PaymentDialog endpoint={'/api/revenue/'+payment.id+'/payments'} amount={payment.totalAmount-payment.paidAmount} accounts={accounts} onClose={()=>setPayment(null)} onSuccess={()=>window.location.reload()}/>}
      {/* Top Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flex: 1, maxWidth: '600px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{ width: '20px', height: '20px', position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input 
              type="text" 
              placeholder="Cari Faktur..." 
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
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button 
          className="btn btn-primary" 
          style={{ height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={handleOpenModal}
        >
          <Plus size={18} /> 
          <span>Buat Faktur</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ boxShadow: 'var(--shadow-md)', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table>
            <thead style={{ background: 'var(--gray-50)' }}>
              <tr>
                <th>Faktur</th>
                <th>Proyek</th>
                <th>Deskripsi</th>
                <th>Subtotal</th>
                <th>Total</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <FileText size={32} style={{ color: 'var(--gray-400)' }} />
                      <p>Tidak Ada Data</p>
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.map((inv) => (
                <tr key={inv.id} style={{ transition: 'background 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)' } onMouseLeave={e => e.currentTarget.style.background = 'transparent' }>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '40px', height: '40px', borderRadius: '10px', 
                        background: 'var(--blue-50)', color: 'var(--blue-600)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <Banknote size={20} />
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, color: 'var(--gray-900)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {inv.invoiceNo}
                          {getStatusBadge(inv.status)}
                        </p>
                        <p style={{ fontSize: '12.5px', color: 'var(--gray-500)', marginTop: '2px', fontWeight: 500 }}>
                          {new Date(inv.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--navy-800)', fontSize: '13px' }}>
                      {inv.project?.name || 'Unknown'}
                    </span>
                  </td>
                  <td>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-600)', background: 'var(--gray-100)', padding: '4px 8px', borderRadius: '6px', display: 'inline-block', marginBottom: '4px' }}>
                        {inv.category}
                      </span>
                      <p style={{ fontSize: '13px', color: 'var(--gray-700)', fontWeight: 500 }}>{inv.description}</p>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--gray-700)', fontSize: '13px' }}>
                      {formatRupiah(inv.subTotal)}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--gray-900)', fontSize: '14px' }}>
                      {formatRupiah(inv.totalAmount)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button 
                        className="btn-ghost" 
                        style={{ padding: '8px', borderRadius: '8px', color: 'var(--blue-600)' }}
                        onClick={() => handlePrint(inv)}
                        title="Cetak"
                      >
                        <Printer size={18} />
                      </button>
                      {['UNPAID','PARTIAL'].includes(inv.status) && (
                        <button 
                          className="btn-ghost" 
                          style={{ padding: '8px', borderRadius: '8px', color: 'var(--green-600)' }}
                          onClick={() => handleUpdateStatus(inv.id, 'PAID')}
                          title="Catat penerimaan"
                        >
                          <Check size={18} />
                        </button>
                      )}
                      <button 
                        className="btn-ghost" 
                        style={{ padding: '8px', borderRadius: '8px', color: 'var(--red-600)' }}
                        onClick={() => handleDelete(inv.id)}
                        disabled={inv.status==='VOID'||inv.paidAmount>0||inv.dpUsedAmount>0} title="Batalkan faktur"
                      >
                        <AlertCircle size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            style={{ 
              position: 'fixed', inset: 0, zIndex: 999, 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)'
            }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div 
              style={{ 
                background: 'white', borderRadius: '20px', width: '100%', maxWidth: '600px', 
                boxShadow: 'var(--shadow-xl)', overflow: 'hidden'
              }}
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            >
              <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy-900)' }}>Buat Faktur Penjualan</h3>
                  
                </div>
                <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: '4px' }}>
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label required">Proyek Terkait</label>
                  <select 
                    className="form-select" 
                    style={{ height: '44px', borderRadius: '10px', fontWeight: 500 }}
                    value={formData.projectId} 
                    onChange={e => setFormData({...formData, projectId: e.target.value, downPaymentId: ''})}
                    required
                  >
                    <option value="" disabled>Pilih Proyek...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label required">Kategori</label>
                    <select
                      className="form-select" 
                      style={{ height: '44px', borderRadius: '10px', fontWeight: 500 }}
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      required
                    >
                      <option value="TERMIN">Termin</option>
                      <option value="PROGRESS_BILLING">Progress Billing</option>
                      <option value="DP">Uang Muka</option>
                      <option value="RETENTION_RELEASE">Pelepasan Retensi</option>
                    </select>
                  </div>
                  {formData.category !== 'DP' && downPaymentOptions.length > 0 && (
                    <div className="form-group">
                      <label className="form-label">Potong Uang Muka</label>
                      <select
                        className="form-select" 
                        style={{ height: '44px', borderRadius: '10px', fontWeight: 500 }}
                        value={formData.downPaymentId}
                        onChange={e => setFormData({...formData, downPaymentId: e.target.value})}
                      >
                        <option value="">Tidak Ada</option>
                        {downPaymentOptions.map(dp => (
                          <option key={dp.id} value={dp.id}>{dp.invoiceNo} - {formatRupiah(dp.subTotal-dp.dpUsedAmount)}</option>
                        ))}
                      </select>
                      {formData.downPaymentId&&<label>Nominal potongan DP<input type="number" className="form-input" min="0.01" step="0.01" placeholder="Kosong = seluruh saldo tersedia" value={formData.downPaymentAmount??''} onChange={e=>setFormData({...formData,downPaymentAmount:e.target.value})}/></label>}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label required">Deskripsi Penagihan</label>
                  <input
                    type="text" required
                    className="form-input" 
                    placeholder="Contoh: Tagihan Termin 1 30%"
                    style={{ height: '44px', borderRadius: '10px' }}
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label required">Subtotal</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-500)', fontWeight: 500 }}>Rp</span>
                      <input
                        type="number" min="0" required
                        className="form-input" 
                        placeholder="0"
                        style={{ height: '44px', borderRadius: '10px', paddingLeft: '44px' }}
                        value={formData.subTotal} 
                        onChange={e => setFormData({...formData, subTotal: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Tarif PPN</label>
                    <input
                      type="number" min="0" step="0.1" required
                      className="form-input" 
                      style={{ height: '44px', borderRadius: '10px' }}
                      value={formData.taxRate} 
                      onChange={e => setFormData({...formData, taxRate: e.target.value})}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label required">Tanggal Faktur</label>
                    <input
                      type="date" required
                      className="form-input" 
                      style={{ height: '44px', borderRadius: '10px' }}
                      value={formData.date} 
                      onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Jatuh Tempo</label>
                    <input
                      type="date"
                      className="form-input" 
                      style={{ height: '44px', borderRadius: '10px' }}
                      value={formData.dueDate} 
                      onChange={e => setFormData({...formData, dueDate: e.target.value})}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', paddingTop: '24px', borderTop: '1px solid var(--gray-100)' }}>
                  <button type="button" className="btn btn-ghost" style={{ padding: '10px 24px', borderRadius: '10px', fontWeight: 600 }} onClick={() => setIsModalOpen(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: '10px', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'center' }} disabled={submitting}>
                    {submitting ? 'Menyimpan...' : 'Simpan Faktur'}
                  </button>
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
          #printable-invoice, #printable-invoice * { visibility: visible; }
          #printable-invoice { position: absolute; left: 0; top: 0; width: 100%; color: black !important; background: white !important; }
        }
      `}} />

      {printInvoice && (
        <div id="printable-invoice" className="hidden print:block p-8 bg-white text-black max-w-4xl mx-auto">
          <div className="flex justify-between items-start border-b border-gray-300 pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">FAKTUR PENJUALAN</h1>
              <p className="text-gray-500 mt-1">{printInvoice.invoiceNo}</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-semibold">PT. Prohaba Jaya Mandiri</h2>
              <p className="text-sm text-gray-600 mt-1">Jl. Contoh Alamat Bisnis No. 123</p>
              <p className="text-sm text-gray-600">NPWP: 01.234.567.8-901.000</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-sm text-gray-500 font-medium">Ditagihkan Kepada:</p>
              <p className="text-lg font-semibold mt-1">{printInvoice.project?.client || 'Klien Proyek'}</p>
              <p className="text-sm text-gray-600">Proyek: {printInvoice.project?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 font-medium">Tanggal Faktur:</p>
              <p className="text-base font-medium">{new Date(printInvoice.date).toLocaleDateString('id-ID')}</p>
              {printInvoice.dueDate && (
                <>
                  <p className="text-sm text-gray-500 font-medium mt-2">Jatuh Tempo:</p>
                  <p className="text-base font-medium">{new Date(printInvoice.dueDate).toLocaleDateString('id-ID')}</p>
                </>
              )}
            </div>
          </div>

          <table className="w-full text-left mb-8">
            <thead>
              <tr className="border-y border-gray-300">
                <th className="py-3 px-4 font-semibold text-gray-700">Keterangan</th>
                <th className="py-3 px-4 font-semibold text-gray-700 text-right">Kategori</th>
                <th className="py-3 px-4 font-semibold text-gray-700 text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-4 px-4">{printInvoice.description}</td>
                <td className="py-4 px-4 text-right">{printInvoice.category}</td>
                <td className="py-4 px-4 text-right font-medium">{formatRupiah(printInvoice.subTotal)}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-end mb-12">
            <div className="w-1/2 space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatRupiah(printInvoice.subTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>PPN</span>
                <span>{formatRupiah(printInvoice.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-300 pt-3">
                <span>Total Tagihan</span>
                <span>{formatRupiah(printInvoice.totalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-end mt-24">
            <div>
              <p className="text-sm text-gray-500 mb-2">Instruksi Pembayaran:</p>
              <p className="text-sm font-medium">Bank BCA - 1234567890</p>
              <p className="text-sm font-medium">a.n PT. Prohaba Jaya Mandiri</p>
            </div>
            <div className="text-center">
              <div className="border-b border-gray-400 w-48 mb-2"></div>
              <p className="text-sm font-medium">Manajemen Keuangan</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
