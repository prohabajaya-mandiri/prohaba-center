'use client';

// Daftar Master Data Karyawan — tampilan sama dengan Database Personel E-HSE. Data dibaca langsung dari E-HSE.
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { UserPlus, Upload, Download, FileSpreadsheet, RefreshCw, Link2, AlertTriangle } from 'lucide-react';
import { Badge, DataTable, FilterBar, Modal, Pager, useSubmit } from '@/components/employees/ui';
import { useDialog } from '@/components/DialogProvider';
import { CATEGORIES, EMPLOYMENT_TYPES, WORK_STATUSES } from '@/lib/hse/personnel';
import { formatDate, iso } from '@/lib/hse/dates';
import { labelOf } from '@/lib/hse/labels';
import EmployeeForm, { EMPTY_EMPLOYEE } from './EmployeeForm';

const LEGACY_CATEGORY = { STAFF: 'STAFF', HARIAN: 'MANPOWER', BORONGAN: 'MANPOWER' };

export default function EmployeesClient({ sites, rows, total, page, canEdit, canEmployment, offline, legacy, sync }) {
  const router = useRouter();
  const params = useSearchParams();
  const { submit, busy } = useSubmit();
  const { showAlert } = useDialog();
  const [adding, setAdding] = useState(null);
  const [importing, setImporting] = useState(false);
  const exportQuery = new URLSearchParams(params.toString());
  exportQuery.delete('resource');

  const runSync = async (action) => {
    const r = await submit('/api/master/employees/sync', { body: { action } });
    if (!r) return;
    if (action === 'sync') await showAlert(`${r.synced} perubahan dari E-HSE diterapkan ke salinan ERP.`, 'Berhasil');
    else await showAlert(`${r.linked} dari ${r.checked} pegawai lama tertaut berdasarkan NIK. ${r.unmatched} belum terdaftar di E-HSE — gunakan tombol Daftarkan.${r.conflicts.length ? '\n\nPerlu dicek manual:\n' + r.conflicts.join('\n') : ''}`, 'Berhasil');
  };

  const register = (e) => setAdding({
    legacyId: e.id,
    initial: {
      ...EMPTY_EMPLOYEE,
      nik: e.nik ?? '', name: e.name, position: e.position, category: LEGACY_CATEGORY[e.employeeType] ?? 'MANPOWER',
      startDate: iso(e.joinDate) ?? '', npwp: e.npwp ?? '', bankName: e.bankName ?? '', bankAccount: e.bankAccount ?? '',
      bpjsKesehatan: e.bpjsKesehatan ?? '', bpjsKetenagakerjaan: e.bpjsKetenagakerjaan ?? '', siteId: sites.length === 1 ? sites[0].id : '',
    },
  });

  return (
    <div className="stack">
      {offline && (
        <div className="notice danger" role="alert">
          <AlertTriangle size={15} style={{ verticalAlign: -2 }} /> {offline} Menampilkan salinan ERP terakhir{sync.at ? ` (${formatDate(sync.at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})` : ''}; data tidak dapat diubah sampai E-HSE kembali terhubung.
        </div>
      )}
      {canEdit && legacy.length > 0 && (
        <details className="card" style={{ padding: '14px 18px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            {legacy.length} pegawai lama di ERP belum tertaut ke Master Data Karyawan
          </summary>
          <p className="muted" style={{ margin: '8px 0 12px' }}>
            Riwayat penugasan, absensi dan payroll tetap tersimpan. Tautkan otomatis bila NIK sudah terdaftar di E-HSE, atau daftarkan
            (form terisi dari data lama, lengkapi alamat KTP & site). Penugasan baru hanya untuk karyawan yang sudah tertaut.
          </p>
          <div style={{ marginBottom: 12 }}>
            <button className="btn btn-outline btn-sm" disabled={busy || Boolean(offline)} onClick={() => runSync('link')}><Link2 size={15} /> Tautkan otomatis berdasarkan NIK</button>
          </div>
          <DataTable rows={legacy} columns={[
            { key: 'name', label: 'Nama', render: (e) => (<div><strong>{e.name}</strong><div className="muted">{e.employeeNo}</div></div>) },
            { key: 'position', label: 'Jabatan' },
            { key: 'nik', label: 'NIK', render: (e) => (e.nik ? '************' + e.nik.slice(-4) : '-') },
            { key: 'act', label: '', render: (e) => <button className="btn btn-primary btn-sm" disabled={Boolean(offline)} onClick={() => register(e)}>Daftarkan</button> },
          ]} />
        </details>
      )}

      <FilterBar keep={['resource']} filters={[
        { type: 'search', label: 'Cari', placeholder: 'Nama, kode, jabatan, NIK' },
        { name: 'siteId', label: 'Site', type: 'select', options: sites.map((s) => [s.id, s.code]) },
        { name: 'category', label: 'Kategori', type: 'select', options: CATEGORIES },
        { name: 'workStatus', label: 'Status kerja', type: 'select', options: WORK_STATUSES },
        { name: 'employmentType', label: 'Kepegawaian', type: 'select', options: [...EMPLOYMENT_TYPES, ['NONE', 'Belum diisi']] },
        { name: 'former', label: 'Data', type: 'select', allLabel: 'Karyawan aktif', options: [['1', 'Mantan karyawan'], ['all', 'Semua']] },
      ]}>
        {canEdit && <button className="btn btn-outline" disabled={busy || Boolean(offline)} onClick={() => runSync('sync')} title={sync.at ? 'Salinan ERP terakhir diperbarui ' + new Date(sync.at).toLocaleString('id-ID') : undefined}><RefreshCw size={16} /> Sinkronkan</button>}
        <a className="btn btn-outline" href={'/api/master/employees/export?' + exportQuery.toString()}><Download size={16} /> Export</a>
        {canEdit && <button className="btn btn-outline" disabled={Boolean(offline)} onClick={() => setImporting(true)}><Upload size={16} /> Import Excel</button>}
        {canEdit && <button className="btn btn-primary" disabled={Boolean(offline)} onClick={() => setAdding({ initial: { ...EMPTY_EMPLOYEE, siteId: sites.length === 1 ? sites[0].id : '' } })}><UserPlus size={16} /> Tambah</button>}
      </FilterBar>

      <div className="card">
        <DataTable
          rows={rows}
          empty="Belum ada karyawan sesuai filter."
          onRowClick={offline ? undefined : (p) => router.push('/master-data/employees/' + p.id)}
          columns={[
            { key: 'name', label: 'Nama', render: (p) => (<div><strong>{p.name}</strong><div className="muted">{p.code} · NIK {p.nik}</div></div>) },
            { key: 'category', label: 'Kategori', render: (p) => labelOf(p.category) },
            { key: 'position', label: 'Jabatan', render: (p) => (<div>{p.position}{p.foreman && <div className="muted">Mandor: {p.foreman.name}</div>}</div>) },
            { key: 'siteName', label: 'Site' },
            { key: 'employmentType', label: 'Kepegawaian', render: (p) => (<div><Badge value={p.employmentType} />{p.employmentType === 'PKWT' && p.contractEndDate && <div className="muted">s/d {formatDate(p.contractEndDate)}</div>}</div>) },
            { key: 'tenure', label: 'Masa kerja', render: (p) => p.tenure ?? '-' },
            { key: 'workStatus', label: 'Status kerja', render: (p) => <Badge value={p.workStatus} /> },
            { key: 'fitness', label: 'Kesehatan', render: (p) => <Badge value={p.fitness} /> },
            { key: 'permitEnd', label: 'Permit s/d', render: (p) => formatDate(p.permitEnd) },
          ]}
        />
      </div>
      <Pager page={page} total={total} />

      <Modal open={Boolean(adding)} onClose={() => setAdding(null)} title={adding?.legacyId ? 'Daftarkan pegawai lama' : 'Tambah karyawan'}
        subtitle="Satu NIK hanya untuk satu profil. Penempatan awal dibuat otomatis. Data tersimpan di E-HSE dan ERP sekaligus." size="modal-xl">
        {adding && <EmployeeForm initial={adding.initial} legacyId={adding.legacyId} sites={sites.filter((s) => s.isActive)} canMedical canBank canEmployment={canEmployment}
          onDone={(r) => { setAdding(null); router.push('/master-data/employees/' + r.id); }} />}
      </Modal>
      <Modal open={importing} onClose={() => setImporting(false)} title="Import karyawan dari Excel" subtitle="File divalidasi dan ditinjau sebelum disimpan." size="modal-xl">
        {importing && <ImportPanel onDone={() => setImporting(false)} />}
      </Modal>
    </div>
  );
}

function ImportPanel({ onDone }) {
  const { submit, busy } = useSubmit();
  const { showAlert } = useDialog();
  const [rows, setRows] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');

  const readFile = async (file) => {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await file.arrayBuffer());
    const sheet = wb.Sheets[wb.SheetNames[0]];
    // Nilai mentah: tanggal Excel tetap berupa nomor seri (dikonversi di server tanpa geser zona waktu),
    // angka tidak diformat ulang. Tanda * pada header wajib dihilangkan agar cocok dengan template.
    const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true })
      .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.replace(/\s*\*\s*$/, ''), v])))
      .filter((r) => Object.values(r).some((v) => String(v).trim() !== ''));
    setFileName(file.name);
    setRows(raw);
    const r = await submit('/api/master/employees/import', { body: { mode: 'preview', rows: raw }, refresh: false });
    setPreview(r);
  };

  const commit = async () => {
    const r = await submit('/api/master/employees/import', { body: { mode: 'commit', rows } });
    if (r) {
      await showAlert(`${r.created} karyawan tersimpan, ${r.skipped} baris dilewati.`, 'Berhasil');
      onDone();
    }
  };

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a className="btn btn-outline btn-sm" href="/api/master/employees/template"><FileSpreadsheet size={15} /> Unduh template standar</a>
        <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
          <Upload size={15} /> Pilih file .xlsx
          <input type="file" hidden accept=".xlsx,.xls" onChange={(e) => e.target.files[0] && readFile(e.target.files[0])} />
        </label>
        {fileName && <span className="muted" style={{ alignSelf: 'center' }}>{fileName}</span>}
      </div>
      {busy && !preview && <div className="muted">Memvalidasi…</div>}
      {preview && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card navy"><div className="kpi-label">Total baris</div><div className="kpi-value">{preview.summary.total}</div></div>
            <div className="kpi-card green"><div className="kpi-label">Siap disimpan</div><div className="kpi-value">{preview.summary.valid}</div></div>
            <div className="kpi-card yellow"><div className="kpi-label">NIK sudah ada</div><div className="kpi-value">{preview.summary.duplicate}</div></div>
            <div className="kpi-card red"><div className="kpi-label">Tidak valid</div><div className="kpi-value">{preview.summary.invalid}</div></div>
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            <DataTable rows={preview.rows} rowKey={(r) => r.row}
              columns={[
                { key: 'row', label: 'Baris' },
                { key: 'name', label: 'Nama' },
                { key: 'nik', label: 'NIK' },
                { key: 'siteCode', label: 'Site' },
                { key: 'category', label: 'Kategori' },
                { key: 'status', label: 'Hasil', render: (r) => r.errors.length ? <ul className="text-red" style={{ margin: 0, paddingLeft: 16 }}>{r.errors.map((e) => <li key={e}>{e}</li>)}</ul> : r.duplicate ? <span className="text-orange">Sudah terdaftar ({r.duplicate}) — dilewati</span> : <span className="text-green">OK{r.warnings?.length ? <span className="text-orange"> — {r.warnings.join(' ')}</span> : null}</span> },
              ]} />
          </div>
          <div className="modal-footer" style={{ padding: 0 }}>
            <button className="btn btn-ghost" onClick={() => { setPreview(null); setRows(null); setFileName(''); }}>Ulangi</button>
            <button className="btn btn-primary" disabled={busy || !preview.summary.valid} onClick={commit}>Simpan {preview.summary.valid} baris valid</button>
          </div>
        </>
      )}
    </div>
  );
}
