'use client';

// Detail karyawan — sama dengan detail personel E-HSE, ditambah tab Penugasan proyek ERP.
// Modul HSE (MCU, permit, roster, kompetensi, mutasi) dikelola di E-HSE; tombol "Kelola" membuka E-HSE.
import { useState } from 'react';
import Link from 'next/link';
import { Edit, Eye, RefreshCw, ArrowLeftRight, FileText, ExternalLink, ArrowLeft } from 'lucide-react';
import { Badge, Card, DataTable, Modal, useSubmit } from '@/components/employees/ui';
import { useDialog } from '@/components/DialogProvider';
import { apiFetch } from '@/lib/client-api';
import { formatDate, iso } from '@/lib/hse/dates';
import { labelOf } from '@/lib/hse/labels';
import { CONTRACT_WARNING_DAYS, WORK_STATUSES } from '@/lib/hse/personnel';
import { permitStatus } from '@/lib/hse/permit';
import EmployeeForm from '../EmployeeForm';

const TABS = [['profil', 'Profil'], ['erp', 'Penugasan proyek'], ['placement', 'Penempatan'], ['mcu', 'MCU'], ['permit', 'Permit & SKS'], ['roster', 'Cuti & Kehadiran'], ['kompetensi', 'Kompetensi'], ['mobilisasi', 'Mobilisasi']];
const PAY_TYPE = { DAILY: 'Harian', MONTHLY: 'Bulanan', UNSET: 'Belum diatur' };
const rupiah = (v) => (v == null ? '-' : 'Rp ' + Number(v).toLocaleString('id-ID'));

export default function EmployeeDetail({ person: p, erp, hseUrl, canEdit, canEmployment }) {
  const [tab, setTab] = useState('profil');
  const [editing, setEditing] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [status, setStatus] = useState({ workStatus: p.workStatus, note: '' });
  const [revealed, setRevealed] = useState({});
  const { submit, busy } = useSubmit();
  const { showAlert } = useDialog();

  const reveal = async (kind) => {
    try {
      const r = await apiFetch(`/api/master/employees/${p.id}/sensitive?kind=${kind}`);
      setRevealed({ ...revealed, ...(await r.json()) });
    } catch (e) {
      showAlert(e.message, 'Gagal');
    }
  };

  const saveStatus = async (e) => {
    e.preventDefault();
    if (await submit(`/api/master/employees/${p.id}/status`, { body: status })) setStatusOpen(false);
  };

  const hse = (path) => (hseUrl ? hseUrl + path : null);
  const manage = (path, label = 'Kelola di E-HSE') => hseUrl && (
    <a className="btn btn-outline btn-sm" href={hse(path)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> {label}</a>
  );
  const item = (label, value) => (<div><dt>{label}</dt><dd>{value || '-'}</dd></div>);
  const now = new Date();

  return (
    <div className="stack">
      <div className="toolbar">
        <Link className="btn btn-ghost btn-sm" href="/master-data?resource=employees"><ArrowLeft size={15} /> Daftar karyawan</Link>
        <Badge value={p.workStatus} />
        {p.employmentType && <Badge value={p.employmentType} />}
        <Badge value={p.fitness} />
        <span className="chip">{labelOf(p.category)}</span>
        {p.isFormer && <span className="chip">Mantan karyawan</span>}
        {p.contractDaysLeft !== null && p.contractDaysLeft <= CONTRACT_WARNING_DAYS && !p.isFormer && (
          <span className="chip" style={{ background: p.contractDaysLeft < 0 ? 'var(--red-100)' : 'var(--yellow-100)' }}>
            {p.contractDaysLeft < 0 ? `Kontrak PKWT berakhir ${-p.contractDaysLeft} hari lalu` : `Kontrak PKWT berakhir ${p.contractDaysLeft} hari lagi`}
          </span>
        )}
        {!p.ocrVerified && p.ktpFileId && <span className="chip" style={{ background: 'var(--yellow-100)' }}>Data KTP belum diverifikasi</span>}
        <div className="spacer" />
        {canEdit && <button className="btn btn-outline btn-sm" onClick={() => setStatusOpen(true)}><RefreshCw size={15} /> Status kerja</button>}
        {canEdit && hseUrl && <a className="btn btn-outline btn-sm" href={hse(`/placements?personnelId=${p.id}`)} target="_blank" rel="noreferrer"><ArrowLeftRight size={15} /> Mutasi</a>}
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}><Edit size={15} /> Edit</button>}
      </div>

      <div className="tabs-bar" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'profil' && (
        <div className="grid-2">
          <Card title="Identitas">
            <dl className="detail-grid">
              <div>
                <dt>NIK</dt>
                <dd>{revealed.nik ?? p.nik} {p.access.ktp && !revealed.nik && <button className="btn btn-ghost btn-sm" onClick={() => reveal('KTP')} title="Tampilkan (tercatat di audit log)" aria-label="Tampilkan NIK"><Eye size={14} /></button>}</dd>
              </div>
              {item('Nama', p.name)}
              {item('Tempat, tanggal lahir', [p.birthPlace, formatDate(p.birthDate)].filter((x) => x && x !== '-').join(', '))}
              {item('Jenis kelamin', p.gender === 'L' ? 'Laki-laki' : p.gender === 'P' ? 'Perempuan' : null)}
              {item('Status nikah', labelOf(p.maritalStatus))}
              {item('Pendidikan', [p.education, p.major].filter(Boolean).join(' — '))}
              {item('Alamat KTP', revealed.ktpAddress ?? (p.access.ktp ? '•••• (klik ikon mata pada NIK)' : '[dibatasi]'))}
              {item('Domisili', p.domicileAddress)}
              {item('Asal daerah', p.originRegion)}
              {item('NPWP', revealed.npwp ?? p.npwp)}
              <div>
                <dt>File KTP</dt>
                <dd>{p.ktpFileId ? <a href={`/api/master/employees/${p.id}/ktp?inline=1`} target="_blank" rel="noreferrer"><FileText size={14} /> Lihat KTP</a> : p.access.ktp ? 'Belum diunggah' : '[dibatasi]'}</dd>
              </div>
            </dl>
          </Card>
          <Card title="Pekerjaan & kontak">
            <dl className="detail-grid">
              {item('Kode internal', p.code)}
              {item('Jabatan', p.position)}
              {item('Site saat ini', p.currentSite ? `${p.currentSite.code} — ${p.currentSite.name}` : null)}
              {item('Site awal', p.initialSite?.code)}
              {item('Tanggal mulai', formatDate(p.startDate))}
              {item('Masa kerja', p.tenure ? p.tenure.label + (p.isFormer ? ' (sampai penempatan terakhir)' : '') : null)}
              {item('Status kepegawaian', p.employmentType ? labelOf(p.employmentType) + (p.employmentType === 'PKWT' && p.contractEndDate ? ` · s/d ${formatDate(p.contractEndDate)}` : '') : 'Belum diisi')}
              {item('Mandor', p.foreman ? `${p.foreman.name} (${p.foreman.code})` : null)}
              {item('No WA', p.phoneWa)}
              {item('Kontak darurat', [p.emergencyName, p.emergencyRelation, p.emergencyPhone].filter(Boolean).join(' · '))}
              {item('BPJS Kesehatan', p.bpjsKesehatan)}
              {item('BPJS TK', p.bpjsKetenagakerjaan)}
              {item('Gol. darah', p.bloodType)}
              {item('Baju / sepatu', [p.shirtSize, p.shoeSize].filter(Boolean).join(' / '))}
              {item('Riwayat penyakit', p.medicalHistory)}
              <div>
                <dt>Rekening</dt>
                <dd>{p.bankName ? `${p.bankName} · ` : ''}{revealed.bankAccount ?? p.bankAccount ?? '-'} {p.access.bank && p.bankAccount && !revealed.bankAccount && <button className="btn btn-ghost btn-sm" onClick={() => reveal('BANK')} aria-label="Tampilkan rekening"><Eye size={14} /></button>}</dd>
              </div>
            </dl>
          </Card>
          {p.crew.length > 0 && (
            <Card title={`Anggota regu (${p.crew.length})`} padding={0}>
              <DataTable rows={p.crew} columns={[{ key: 'name', label: 'Nama', render: (c) => <Link href={'/master-data/employees/' + c.id}>{c.name}</Link> }, { key: 'code', label: 'Kode' }, { key: 'position', label: 'Jabatan' }]} />
            </Card>
          )}
        </div>
      )}

      {tab === 'erp' && (
        <Card title="Penugasan & tarif proyek (ERP)" padding={0} actions={<Link className="btn btn-outline btn-sm" href="/master-data?resource=assignments">Kelola penugasan</Link>}>
          <DataTable rows={erp.projects} empty={erp.id ? 'Belum ada penugasan proyek.' : 'Salinan ERP belum tersedia — klik Sinkronkan pada daftar karyawan.'} columns={[
            { key: 'project', label: 'Proyek', render: (a) => `${a.project.code} — ${a.project.name}` },
            { key: 'role', label: 'Posisi di proyek' },
            { key: 'period', label: 'Periode', render: (a) => `${formatDate(a.startDate)} – ${a.endDate ? formatDate(a.endDate) : 'sekarang'}` },
            { key: 'payType', label: 'Dasar gaji', render: (a) => PAY_TYPE[a.payType] ?? a.payType },
            { key: 'rate', label: 'Tarif', num: true, render: (a) => rupiah(a.payType === 'MONTHLY' ? a.monthlyRate : a.dailyRate) },
            { key: 'ot', label: 'Lembur/jam', num: true, render: (a) => rupiah(a.overtimeRate) },
          ]} />
        </Card>
      )}

      {tab === 'placement' && (
        <div className="stack">
          <Card title="Riwayat penempatan" padding={0}>
            <DataTable rows={p.placements} columns={[
              { key: 'site', label: 'Site', render: (r) => `${r.site.code} — ${r.site.name}` },
              { key: 'position', label: 'Jabatan' },
              { key: 'start', label: 'Mulai', render: (r) => formatDate(r.startDate) },
              { key: 'end', label: 'Akhir', render: (r) => formatDate(r.endDate) },
              { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
              { key: 'reason', label: 'Keterangan', render: (r) => [labelOf(r.endReason), r.notes].filter(Boolean).join(' · ') || '-' },
            ]} />
          </Card>
          <Card title="Pengajuan mutasi" padding={0}>
            <DataTable rows={p.mutations} empty="Belum ada mutasi." columns={[
              { key: 'number', label: 'Nomor' },
              { key: 'to', label: 'Tujuan', render: (m) => `${m.toSite.code} · ${m.toPosition}` },
              { key: 'eff', label: 'Efektif', render: (m) => formatDate(m.effectiveDate) },
              { key: 'status', label: 'Status', render: (m) => <Badge value={m.status} /> },
              { key: 'dec', label: 'Keputusan HO', render: (m) => (m.decidedName ? `${m.decidedName}: ${m.decisionNote ?? ''}` : '-') },
            ]} />
          </Card>
        </div>
      )}

      {tab === 'mcu' && (
        <Card title="Riwayat MCU" padding={0} actions={manage(`/mcu?personnelId=${p.id}`)}>
          <DataTable rows={p.mcus} empty="Belum ada MCU." columns={[
            { key: 'type', label: 'Jenis', render: (m) => labelOf(m.type) },
            { key: 'clinic', label: 'Klinik' },
            { key: 'date', label: 'Tgl MCU', render: (m) => formatDate(m.mcuDate) },
            { key: 'stage', label: 'Tahap', render: (m) => <Badge value={m.stage} /> },
            { key: 'result', label: 'Hasil', render: (m) => <Badge value={m.result} /> },
            { key: 'valid', label: 'Berlaku s/d', render: (m) => formatDate(m.validUntil) },
            { key: 'notes', label: 'Catatan medis', render: (m) => m.notes ?? '-' },
          ]} />
        </Card>
      )}

      {tab === 'permit' && (
        <Card title="Riwayat permit & SKS" padding={0} actions={manage(`/permits?personnelId=${p.id}`)}>
          <DataTable rows={p.permits} empty="Belum ada permit." columns={[
            { key: 'kind', label: 'Jenis', render: (r) => `${labelOf(r.kind)} · ${r.permitType}` },
            { key: 'number', label: 'Nomor' },
            { key: 'site', label: 'Site', render: (r) => r.site.code },
            { key: 'period', label: 'Masa berlaku', render: (r) => `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` },
            { key: 'status', label: 'Status', render: (r) => <Badge value={permitStatus(r, now)} /> },
          ]} />
        </Card>
      )}

      {tab === 'roster' && (
        <Card title="Cuti, izin & sakit (20 terakhir)" padding={0} actions={manage(`/roster?personnelId=${p.id}`)}>
          <DataTable rows={p.leaves} empty="Belum ada catatan." columns={[
            { key: 'type', label: 'Jenis', render: (l) => <Badge value={l.type} /> },
            { key: 'period', label: 'Periode', render: (l) => `${formatDate(l.startDate)} – ${formatDate(l.endDate)}` },
            { key: 'ret', label: 'Kembali', render: (l) => formatDate(l.returnDate) },
            { key: 'status', label: 'Status', render: (l) => <Badge value={l.status} /> },
            { key: 'reason', label: 'Keterangan' },
          ]} />
        </Card>
      )}

      {tab === 'kompetensi' && (
        <Card title="Sertifikat & kompetensi" padding={0} actions={manage(`/training?tab=certificates&personnelId=${p.id}`)}>
          <DataTable rows={p.certificates} empty="Belum ada sertifikat (opsional pada data awal)." columns={[
            { key: 'c', label: 'Kompetensi', render: (c) => c.competency.name },
            { key: 'certNumber', label: 'No sertifikat' },
            { key: 'issuer', label: 'Penerbit' },
            { key: 'exp', label: 'Berlaku s/d', render: (c) => formatDate(c.expiryDate) },
          ]} />
        </Card>
      )}

      {tab === 'mobilisasi' && (
        <Card title="Riwayat mobilisasi & demobilisasi" padding={0}>
          <DataTable rows={p.mobilizations} empty="Belum ada mobilisasi." columns={[
            { key: 'code', label: 'Kloter', render: (m) => m.mobilization.code },
            { key: 'type', label: 'Jenis', render: (m) => labelOf(m.mobilization.type) },
            { key: 'date', label: 'Berangkat', render: (m) => formatDate(m.mobilization.departDate) },
            { key: 'dest', label: 'Tujuan', render: (m) => m.mobilization.destination },
            { key: 'status', label: 'Status', render: (m) => <Badge value={m.mobilization.status} /> },
            { key: 'arr', label: 'Tiba', render: (m) => (m.arrived ? formatDate(m.arrivedAt) : '-') },
          ]} />
        </Card>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit karyawan" subtitle="Field sensitif (NIK, alamat KTP, rekening) diisi hanya bila diubah. Perubahan tersimpan di E-HSE dan ERP." size="modal-xl">
        {editing && (
          <EmployeeForm editing={p.id} sites={[]} canMedical={p.access.medical} canBank={p.access.bank} canEmployment={canEmployment}
            initial={{
              nik: '', nikMasked: p.nik, name: p.name, birthPlace: p.birthPlace ?? '', birthDate: iso(p.birthDate) ?? '', gender: p.gender ?? '',
              maritalStatus: p.maritalStatus ?? '', education: p.education ?? '', major: p.major ?? '', phoneWa: p.phoneWa ?? '',
              emergencyName: p.emergencyName ?? '', emergencyPhone: p.emergencyPhone ?? '', emergencyRelation: p.emergencyRelation ?? '',
              ktpAddress: '', domicileAddress: p.domicileAddress ?? '', originRegion: p.originRegion ?? '', category: p.category, position: p.position,
              startDate: iso(p.startDate) ?? '', employmentType: p.employmentType ?? '', contractEndDate: iso(p.contractEndDate) ?? '',
              npwp: '', npwpMasked: p.npwp && p.npwp !== '[dibatasi]' ? p.npwp : '', bpjsKesehatan: p.bpjsKesehatan ?? '', bpjsKetenagakerjaan: p.bpjsKetenagakerjaan ?? '',
              bloodType: p.bloodType ?? '', medicalHistory: '', shirtSize: p.shirtSize ?? '', shoeSize: p.shoeSize ?? '', bankName: p.bankName ?? '',
              bankAccount: '', bankAccountName: p.bankAccountName ?? '', foremanId: p.foremanId ?? '', ocrVerified: p.ocrVerified,
            }}
            onDone={() => setEditing(false)} />
        )}
      </Modal>

      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} title="Ubah status kerja" subtitle="Perubahan tercatat di audit log E-HSE dan langsung berlaku untuk penugasan & payroll ERP.">
        <form onSubmit={saveStatus} className="stack">
          <select className="form-select" aria-label="Status kerja" value={status.workStatus} onChange={(e) => setStatus({ ...status, workStatus: e.target.value })}>
            {WORK_STATUSES.map((s) => <option key={s} value={s}>{labelOf(s)}</option>)}
          </select>
          <textarea className="form-input" rows={3} placeholder="Catatan / alasan" aria-label="Catatan" value={status.note} onChange={(e) => setStatus({ ...status, note: e.target.value })} />
          <div className="notice">Mutasi antar-site tetap melalui pengajuan mutasi dan disahkan HO di E-HSE. Status Resign menonaktifkan karyawan untuk penugasan & payroll baru.</div>
          <button className="btn btn-primary" disabled={busy}>Simpan</button>
        </form>
      </Modal>
    </div>
  );
}
