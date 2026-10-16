'use client';
import { apiFetch, businessToday } from '@/lib/client-api';

import PaymentDialog from '@/components/PaymentDialog';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Printer, HandCoins, Ban } from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';
import { EmptyRow, Modal, PrintDoc, SearchField, StatusBadge, printDocument } from '@/components/ui';
import { INVOICE_CATEGORY, idr, fmtDate } from '@/lib/ui-labels';

const EMPTY_FORM = () => ({ projectId: '', description: '', subTotal: '', taxRate: '11', date: businessToday(), dueDate: '', category: 'TERMIN', downPaymentId: '', downPaymentAmount: '' });

export default function RevenueClient({ invoices, projects, accounts, downPayments }) {
  const router = useRouter();
  const [payment, setPayment] = useState(null);
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('ALL');
  const [formData, setFormData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [printInvoice, setPrintInvoice] = useState(null);
  const { showAlert, showConfirm } = useDialog();

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      const matchSearch = !q || inv.invoiceNo.toLowerCase().includes(q) || inv.description.toLowerCase().includes(q);
      return matchSearch && (filterProject === 'ALL' || inv.projectId === filterProject);
    });
  }, [invoices, search, filterProject]);

  const formProjectId = formData?.projectId;
  const downPaymentOptions = useMemo(
    () => (formProjectId ? downPayments.filter((inv) => inv.projectId === formProjectId) : []),
    [downPayments, formProjectId],
  );

  const subTotal = Number(formData?.subTotal) || 0;
  const taxPreview = subTotal * (Number(formData?.taxRate) || 0) / 100;

  const handlePrint = (invoice) => {
    setPrintInvoice(invoice);
    printDocument();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.dueDate && formData.dueDate < formData.date) {
      await showAlert('Jatuh tempo tidak boleh sebelum tanggal faktur.', 'Periksa kembali');
      return;
    }
    setSubmitting(true);
    try {
      const body = { ...formData, downPaymentAmount: formData.downPaymentAmount || undefined };
      if (!body.downPaymentId) delete body.downPaymentAmount;
      await apiFetch('/api/revenue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setFormData(null);
      router.refresh();
      await showAlert('Faktur penjualan tersimpan.', 'Berhasil');
    } catch (err) {
      await showAlert(err.message, 'Gagal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoid = async (inv) => {
    const confirmed = await showConfirm(`Batalkan faktur ${inv.invoiceNo} dan buat jurnal pembalik? Riwayat tetap disimpan.`, 'Batalkan faktur');
    if (!confirmed) return;
    try {
      await apiFetch(`/api/revenue/${inv.id}`, { method: 'DELETE' });
      router.refresh();
    } catch (err) {
      await showAlert(err.message, 'Gagal');
    }
  };

  const set = (key) => (e) => setFormData((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="stack">
      {payment && (
        <PaymentDialog
          endpoint={'/api/revenue/' + payment.id + '/payments'}
          amount={payment.totalAmount - payment.paidAmount}
          accounts={accounts}
          title={`Penerimaan faktur ${payment.invoiceNo}`}
          onClose={() => setPayment(null)}
          onSuccess={() => { setPayment(null); router.refresh(); }}
        />
      )}

      <div className="toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="Cari nomor faktur atau deskripsi" />
        <select className="form-select" aria-label="Filter proyek" style={{ width: 260, flex: '0 1 260px' }} value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
          <option value="ALL">Semua proyek</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setFormData({ ...EMPTY_FORM(), projectId: projects[0]?.id || '' })}>
          <Plus aria-hidden /> Buat faktur
        </button>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Faktur</th>
                <th>Proyek</th>
                <th>Deskripsi</th>
                <th className="num">Subtotal</th>
                <th className="num">Total</th>
                <th>Status</th>
                <th className="num">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <EmptyRow colSpan={7} title={invoices.length ? 'Tidak ada faktur yang cocok' : 'Belum ada faktur penjualan'} />
              ) : filteredInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="nowrap">
                    <div className="cell-title">{inv.invoiceNo}</div>
                    <div className="cell-sub">{fmtDate(inv.date)}</div>
                  </td>
                  <td>{inv.project?.code ? <><div style={{ fontWeight: 500, color: 'var(--gray-900)' }}>{inv.project.code}</div><div className="cell-sub">{inv.project.name}</div></> : inv.project?.name || '-'}</td>
                  <td style={{ minWidth: 200 }}>
                    <span className="chip" style={{ marginBottom: 4 }}>{INVOICE_CATEGORY[inv.category] ?? inv.category}</span>
                    <div>{inv.description}</div>
                  </td>
                  <td className="num">{idr(inv.subTotal)}</td>
                  <td className="num" style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{idr(inv.totalAmount)}</td>
                  <td><StatusBadge value={inv.status} /></td>
                  <td>
                    <div className="row-actions">
                      <button className="action-btn" onClick={() => handlePrint(inv)} title="Cetak faktur" aria-label={`Cetak ${inv.invoiceNo}`}><Printer /></button>
                      {['UNPAID', 'PARTIAL'].includes(inv.status) && (
                        <button className="action-btn success" onClick={() => setPayment(inv)} title="Catat penerimaan" aria-label={`Catat penerimaan ${inv.invoiceNo}`}><HandCoins /></button>
                      )}
                      <button className="action-btn danger" onClick={() => handleVoid(inv)} disabled={inv.status === 'VOID' || inv.paidAmount > 0 || inv.dpUsedAmount > 0} title="Batalkan faktur" aria-label={`Batalkan ${inv.invoiceNo}`}><Ban /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {formData && (
        <Modal
          title="Buat faktur penjualan"
          onClose={() => setFormData(null)}
          busy={submitting}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setFormData(null)} disabled={submitting}>Batal</button>
              <button type="submit" form="invoice-form" className="btn btn-primary" disabled={submitting}>{submitting ? 'Menyimpan…' : 'Simpan faktur'}</button>
            </>
          }
        >
          <form id="invoice-form" onSubmit={handleSubmit} className="form-stack">
            <div className="form-group">
              <label className="form-label required" htmlFor="inv-project">Proyek</label>
              <select id="inv-project" className="form-select" value={formData.projectId} onChange={(e) => setFormData({ ...formData, projectId: e.target.value, downPaymentId: '', downPaymentAmount: '' })} required>
                <option value="" disabled>Pilih proyek</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="inv-cat">Kategori</label>
                <select id="inv-cat" className="form-select" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value, downPaymentId: '', downPaymentAmount: '' })} required>
                  {Object.entries(INVOICE_CATEGORY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {formData.category !== 'DP' && downPaymentOptions.length > 0 && (
                <div className="form-group">
                  <label className="form-label" htmlFor="inv-dp">Potong uang muka</label>
                  <select id="inv-dp" className="form-select" value={formData.downPaymentId} onChange={set('downPaymentId')}>
                    <option value="">Tidak dipotong</option>
                    {downPaymentOptions.map((dp) => <option key={dp.id} value={dp.id}>{dp.invoiceNo} — sisa {idr(dp.subTotal - dp.dpUsedAmount)}</option>)}
                  </select>
                </div>
              )}
            </div>

            {formData.downPaymentId && (
              <div className="form-group">
                <label className="form-label" htmlFor="inv-dp-amt">Nominal potongan uang muka (Rp)</label>
                <input id="inv-dp-amt" type="number" className="form-input" min="0.01" step="0.01" placeholder="Kosongkan untuk memakai seluruh sisa uang muka" value={formData.downPaymentAmount} onChange={set('downPaymentAmount')} />
              </div>
            )}

            <div className="form-group">
              <label className="form-label required" htmlFor="inv-desc">Deskripsi penagihan</label>
              <input id="inv-desc" required className="form-input" placeholder="Contoh: Tagihan termin 1 (30%)" value={formData.description} onChange={set('description')} />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="inv-sub">Subtotal (Rp)</label>
                <input id="inv-sub" type="number" min="0" required className="form-input" value={formData.subTotal} onChange={set('subTotal')} />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="inv-tax">Tarif PPN (%)</label>
                <input id="inv-tax" type="number" min="0" step="0.1" required className="form-input" value={formData.taxRate} onChange={set('taxRate')} />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="inv-date">Tanggal faktur</label>
                <input id="inv-date" type="date" required className="form-input" value={formData.date} onChange={set('date')} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="inv-due">Jatuh tempo</label>
                <input id="inv-due" type="date" className="form-input" min={formData.date || undefined} value={formData.dueDate} onChange={set('dueDate')} />
              </div>
            </div>

            {subTotal > 0 && (
              <div className="notice info" style={{ display: 'grid', gap: 2 }}>
                <span>PPN: <strong>{idr(taxPreview)}</strong></span>
                <span>Perkiraan total sebelum potongan uang muka: <strong>{idr(subTotal + taxPreview)}</strong></span>
              </div>
            )}
          </form>
        </Modal>
      )}

      {printInvoice && (
        <PrintDoc>
          <div className="print-doc-head">
            <div className="print-doc-brand">
              <img src="/brand/prohaba-logo.png" alt="" />
              <div>
                <strong>PT. Prohaba Jaya Mandiri</strong>
              </div>
            </div>
            <div className="print-doc-title">
              <h1>FAKTUR PENJUALAN</h1>
              <p>{printInvoice.invoiceNo}</p>
            </div>
          </div>

          <div className="print-doc-parties">
            <div>
              <div className="print-doc-label">Ditagihkan kepada</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{printInvoice.project?.client || '-'}</div>
              <div>Proyek: {printInvoice.project?.code ? `${printInvoice.project.code} — ` : ''}{printInvoice.project?.name}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="print-doc-label">Tanggal faktur</div>
              <div>{fmtDate(printInvoice.date, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              {printInvoice.dueDate && (
                <>
                  <div className="print-doc-label" style={{ marginTop: 8 }}>Jatuh tempo</div>
                  <div>{fmtDate(printInvoice.dueDate, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </>
              )}
            </div>
          </div>

          <table>
            <thead>
              <tr><th>Keterangan</th><th>Kategori</th><th className="num">Jumlah</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>{printInvoice.description}</td>
                <td>{INVOICE_CATEGORY[printInvoice.category] ?? printInvoice.category}</td>
                <td className="num">{idr(printInvoice.subTotal)}</td>
              </tr>
            </tbody>
          </table>

          <div className="print-doc-totals">
            <div><span>Subtotal</span><span>{idr(printInvoice.subTotal)}</span></div>
            <div><span>PPN</span><span>{idr(printInvoice.taxAmount)}</span></div>
            <div className="grand"><span>Total tagihan</span><span>{idr(printInvoice.totalAmount)}</span></div>
          </div>

          <div className="print-doc-signs">
            <div />
            <div />
            <div>
              <div>Hormat kami,</div>
              <div className="line" />
              <div>Manajemen Keuangan</div>
            </div>
          </div>
        </PrintDoc>
      )}
    </div>
  );
}
