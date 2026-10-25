'use client';
import { apiFetch } from '@/lib/client-api';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Ban, CheckCircle2, ClipboardCheck, Droplet, Eye, ShieldAlert, Truck, XCircle } from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';
import { EmptyRow, Modal, StatusBadge } from '@/components/ui';
import { idr, fmtDate } from '@/lib/ui-labels';
import {
  COUNT_DUE_DAYS,
  DRUM_LITERS,
  FUEL_METHODS,
  REQUEST_STATUS,
  REQUEST_TONE,
  SHIPMENT_STATUS,
  SHIPMENT_TONE,
  USAGE_WINDOW_DAYS,
  countTolerance,
  liters,
} from '@/lib/fuel';

const SEVERITY = { high: ['Tinggi', 'danger'], medium: ['Sedang', 'warning'], info: ['Info', 'gray'] };
const dateTime = (v) => (v ? new Date(v).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
const drums = (l) => (l / DRUM_LITERS).toLocaleString('id-ID', { maximumFractionDigits: 1 });

// BBM drum site untuk Logistik HO: stok tiap site, kiriman & pengajuan, dan anomali.
export default function FuelControlClient({ tab, data, canEdit }) {
  if (tab === 'bbm-kirim') return <Shipments data={data} canEdit={canEdit} />;
  if (tab === 'bbm-anomali') return <Anomalies anomalies={data.anomalies} />;
  return <Stock data={data} canEdit={canEdit} />;
}

// ─── Stok per site ──────────────────────────────────────────────────────────
function Stock({ data, canEdit }) {
  const { sites, anomalies } = data;
  const [selectedId, setSelectedId] = useState(sites[0]?.id ?? null);
  const selected = sites.find((s) => s.id === selectedId);
  const total = sites.reduce((s, x) => s + x.stock, 0);
  const transit = sites.reduce((s, x) => s + x.inTransit, 0);
  const usage = sites.reduce((s, x) => s + x.usage, 0);
  const high = anomalies.filter((a) => a.severity === 'high').length;
  return (
    <div className="stack">
      <div className="kpi-grid">
        <div className="kpi-card navy">
          <div className="kpi-icon"><Droplet size={20} /></div>
          <div className="kpi-label">Stok sistem semua site</div>
          <div className="kpi-value">{liters(total)}</div>
          <div className="kpi-trend">≈ {drums(total)} drum</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-icon"><Truck size={20} /></div>
          <div className="kpi-label">Dalam perjalanan</div>
          <div className="kpi-value">{liters(transit)}</div>
          <div className="kpi-trend">belum dikonfirmasi site</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-icon"><ClipboardCheck size={20} /></div>
          <div className="kpi-label">Pemakaian {USAGE_WINDOW_DAYS} hari</div>
          <div className="kpi-value">{liters(usage)}</div>
          <div className="kpi-trend">semua site</div>
        </div>
        <div className={'kpi-card ' + (high ? 'red' : 'green')}>
          <div className="kpi-icon"><ShieldAlert size={20} /></div>
          <div className="kpi-label">Anomali tinggi</div>
          <div className="kpi-value">{high}</div>
          <div className="kpi-trend">lihat tab Anomali BBM</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Stok BBM per site</div>
          <span className="card-subtitle">Stok = opname terakhir + diterima − dikeluarkan sesudahnya. Klik baris untuk rincian.</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Site</th>
                <th className="num">Stok sistem</th>
                <th className="num">Dalam perjalanan</th>
                <th className="num">Pemakaian {USAGE_WINDOW_DAYS} hari</th>
                <th className="num">Cukup</th>
                <th>Opname terakhir</th>
                <th className="num">Porsi perkiraan</th>
                <th className="num">Harga rata-rata</th>
              </tr>
            </thead>
            <tbody>
              {sites.length === 0 && <EmptyRow colSpan={8} title="Belum ada BBM drum" hint="Kirim drum ke site lewat tab Kiriman & pengajuan BBM." />}
              {sites.map((s) => (
                <tr key={s.id} onClick={() => setSelectedId(s.id)} style={{ cursor: 'pointer', background: s.id === selectedId ? 'var(--gray-50)' : undefined }}>
                  <td><div className="cell-title">{s.code}</div><div className="cell-sub">{s.name}</div></td>
                  <td className="num" style={{ fontWeight: 600, color: s.stock < 0 ? 'var(--red-600)' : undefined }}>{liters(s.stock)}<div className="cell-sub">≈ {drums(s.stock)} drum</div></td>
                  <td className="num">{s.inTransit ? liters(s.inTransit) : '-'}</td>
                  <td className="num">{liters(s.usage)}<div className="cell-sub">{liters(s.perDay)}/hari</div></td>
                  <td className="num">{s.daysCover != null ? `${s.daysCover} hari` : '-'}</td>
                  <td>
                    {s.lastCount ? (
                      <>
                        <span className={'badge badge-' + (s.lastCount.flagged ? 'danger' : 'success')}>{s.lastCount.variance > 0 ? '+' : ''}{liters(s.lastCount.variance)}</span>
                        <div className={'cell-sub' + (s.countAge > COUNT_DUE_DAYS ? ' text-danger' : '')}>{s.countAge} hari lalu</div>
                      </>
                    ) : <span className="badge badge-warning">Belum pernah</span>}
                  </td>
                  <td className="num">{Math.round(s.estimatedShare * 100)}%</td>
                  <td className="num">{s.avgPrice ? idr(s.avgPrice) + '/L' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <SiteDetail site={selected} issues={data.issues.filter((i) => i.projectId === selected.id)} canEdit={canEdit} />}
    </div>
  );
}

function SiteDetail({ site, issues, canEdit }) {
  const router = useRouter();
  const { showPrompt, showAlert } = useDialog();
  async function voidIssue(issue) {
    const reason = await showPrompt(`Batalkan pengambilan ${liters(issue.liters)} untuk ${issue.vehicle.name}? Catatan tetap tersimpan dan tercatat di audit log, tetapi tidak dihitung di stok. Tulis alasannya:`, 'Batalkan catatan');
    if (!reason?.trim()) return;
    try {
      await apiFetch(`/api/logistik/bbm/issues/${issue.id}/void`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason.trim() }) });
      router.refresh();
    } catch (err) {
      await showAlert(err.message, 'Gagal');
    }
  }
  return (
    <>
      <div className="grid-2" style={{ display: 'grid', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Riwayat opname {site.code}</div>
            <span className="card-subtitle">Selisih wajar: maks. 2% dari BBM keluar sejak opname sebelumnya (min. 10 L)</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Tanggal</th><th className="num">Fisik</th><th className="num">Sistem</th><th className="num">Selisih</th><th>Oleh</th></tr></thead>
              <tbody>
                {site.counts.length === 0 && <EmptyRow colSpan={5} title="Belum ada opname" />}
                {site.counts.map((c) => (
                  <tr key={c.id}>
                    <td className="nowrap">{dateTime(c.at)}<div className="cell-sub">{c.fullDrums} penuh + {liters(c.openLiters)}</div></td>
                    <td className="num">{liters(c.physical)}</td>
                    <td className="num">{liters(c.system)}<div className="cell-sub">keluar {liters(c.issuedSince)}</div></td>
                    <td className="num">
                      <span className={'badge badge-' + (c.flagged ? 'danger' : 'success')} title={`Batas wajar ±${liters(countTolerance(c.issuedSince))}`}>{c.variance > 0 ? '+' : ''}{liters(c.variance)}</span>
                    </td>
                    <td>{c.by}{c.notes && <div className="cell-sub">{c.notes}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Pengambil terbanyak (30 hari)</div>
            <span className="card-subtitle">Total {liters(site.recentLiters)} keluar</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Pengambil</th><th className="num">Kali</th><th className="num">Liter</th></tr></thead>
              <tbody>
                {site.takers.length === 0 && <EmptyRow colSpan={3} title="Belum ada pengambilan" />}
                {site.takers.map((t) => (
                  <tr key={t.name}><td>{t.name}</td><td className="num">{t.count}</td><td className="num">{liters(t.liters)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Pengeluaran BBM {site.code} (90 hari)</div>
          <span className="card-subtitle">Dicatat petugas BBM di HP; tanda offline = dikirim setelah sinyal kembali</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Waktu</th><th>Unit</th><th>Pengambil</th><th className="num">Liter</th><th>HM/km</th><th>Cara takar</th><th>Petugas</th><th className="num">Aksi</th></tr>
            </thead>
            <tbody>
              {issues.length === 0 && <EmptyRow colSpan={8} title="Belum ada pengeluaran BBM" />}
              {issues.map((i) => (
                <tr key={i.id} style={i.voidedAt ? { opacity: 0.55 } : undefined}>
                  <td className="nowrap">
                    {dateTime(i.date)}
                    {new Date(i.receivedAt) - new Date(i.date) > 5 * 60000 && <div className="cell-sub">offline · terkirim {dateTime(i.receivedAt)}</div>}
                  </td>
                  <td><div className="cell-title">{i.vehicle.code ?? i.vehicle.name}</div><div className="cell-sub">{i.vehicle.name}</div></td>
                  <td>{i.employee ? <>{i.employee.name}<div className="cell-sub">{i.employee.nip ? `NIP ${i.employee.nip}` : 'kartu QR'}</div></> : <>{i.takerName}<div className="cell-sub text-danger">tanpa kartu</div></>}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{liters(i.liters)}</td>
                  <td>{i.meterValue != null ? i.meterValue.toLocaleString('id-ID') : i.runHours ? `${i.runHours} jam nyala` : '-'}</td>
                  <td>{FUEL_METHODS[i.method] ?? '-'}</td>
                  <td>{i.user.name}{i.notes && <div className="cell-sub">{i.notes}</div>}</td>
                  <td>
                    <div className="row-actions">
                      {i.photo && <a className="btn btn-outline btn-sm" href={`/api/logistik/bbm/issues/${i.id}/photo`} target="_blank" rel="noreferrer"><Eye aria-hidden /> Foto</a>}
                      {i.voidedAt ? <span className="badge badge-gray" title={i.voidReason}>Dibatalkan</span> : canEdit && <button type="button" className="btn btn-ghost btn-sm" onClick={() => voidIssue(i)}><Ban aria-hidden /> Batalkan</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Kiriman & pengajuan ────────────────────────────────────────────────────
const EMPTY_SHIPMENT = { projectId: '', requestId: '', drums: '', liters: '', pricePerLiter: '', driver: '', plateNumber: '', sealNumbers: '', notes: '' };

function Shipments({ data, canEdit }) {
  const router = useRouter();
  const { showPrompt, showConfirm, showAlert } = useDialog();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  function openForm(request) {
    setError('');
    const n = request?.drums ?? '';
    setForm({ ...EMPTY_SHIPMENT, projectId: request?.projectId ?? '', requestId: request?.id ?? '', drums: String(n), liters: n ? String(n * DRUM_LITERS) : '' });
  }

  async function post(url, body) {
    try {
      await apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      router.refresh();
      return true;
    } catch (err) {
      await showAlert(err.message, 'Gagal');
      return false;
    }
  }

  async function decide(request, decision) {
    if (decision === 'APPROVED') {
      if (await showConfirm(`Setujui pengajuan ${request.number}: ${request.drums} drum untuk ${request.project.code}?`, 'Setujui pengajuan'))
        post(`/api/logistik/bbm/requests/${request.id}/decision`, { decision });
      return;
    }
    const notes = await showPrompt(`Tolak pengajuan ${request.number}? Tulis alasan untuk site:`, 'Tolak pengajuan');
    if (notes?.trim()) post(`/api/logistik/bbm/requests/${request.id}/decision`, { decision, notes: notes.trim() });
  }

  async function cancel(shipment) {
    const reason = await showPrompt(`Batalkan kiriman ${shipment.number}? Tulis alasannya:`, 'Batalkan kiriman');
    if (reason?.trim()) post(`/api/logistik/bbm/shipments/${shipment.id}/cancel`, { reason: reason.trim() });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/logistik/bbm/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, requestId: form.requestId || null, drums: Number(form.drums), liters: Number(form.liters), pricePerLiter: Number(form.pricePerLiter) }),
      });
      setForm(null);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {canEdit && (
        <div className="toolbar">
          <div className="spacer" />
          <button type="button" className="btn btn-primary" onClick={() => openForm(null)}><Truck aria-hidden /> Kirim drum ke site</button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title">Pengajuan drum dari site</div>
          <span className="card-subtitle">Angka stok & pemakaian disalin sistem saat site mengajukan</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>No.</th><th>Site</th><th>Diajukan</th><th className="num">Drum</th><th className="num">Stok saat itu</th><th className="num">Pemakaian {USAGE_WINDOW_DAYS} hari</th><th>Opname terakhir</th><th>Status</th><th className="num">Aksi</th></tr>
            </thead>
            <tbody>
              {data.requests.length === 0 && <EmptyRow colSpan={9} title="Belum ada pengajuan" />}
              {data.requests.map((r) => {
                const perDay = r.usage14d / USAGE_WINDOW_DAYS;
                const countAge = r.lastCountAt ? Math.floor((new Date(r.requestedAt) - new Date(r.lastCountAt)) / 86400000) : null;
                return (
                  <tr key={r.id}>
                    <td className="cell-title">{r.number}</td>
                    <td>{r.project.code}<div className="cell-sub">{r.project.name}</div></td>
                    <td className="nowrap">{dateTime(r.requestedAt)}<div className="cell-sub">{r.requester.name}</div></td>
                    <td className="num" style={{ fontWeight: 600 }}>{r.drums}<div className="cell-sub">{liters(r.drums * DRUM_LITERS)}</div></td>
                    <td className="num">{liters(r.stockLiters)}<div className="cell-sub">{perDay > 0 ? `cukup ${Math.floor(r.stockLiters / perDay)} hari` : '-'}</div></td>
                    <td className="num">{liters(r.usage14d)}<div className="cell-sub">{liters(perDay)}/hari</div></td>
                    <td>{countAge == null ? <span className="badge badge-warning">Belum pernah</span> : <span className={'badge badge-' + (countAge > COUNT_DUE_DAYS ? 'warning' : 'gray')}>{countAge} hari sebelumnya</span>}</td>
                    <td>
                      <StatusBadge value={r.status} labels={REQUEST_STATUS} tones={REQUEST_TONE} />
                      {(r.notes || r.decisionNotes) && <div className="cell-sub">{[r.notes, r.decisionNotes && 'HO: ' + r.decisionNotes].filter(Boolean).join(' · ')}</div>}
                      {r.shipment && <div className="cell-sub">{r.shipment.number}</div>}
                    </td>
                    <td>
                      {canEdit && (
                        <div className="row-actions">
                          {r.status === 'SUBMITTED' && (
                            <>
                              <button type="button" className="btn btn-outline btn-sm" onClick={() => decide(r, 'APPROVED')}><CheckCircle2 aria-hidden /> Setujui</button>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => decide(r, 'REJECTED')}><XCircle aria-hidden /> Tolak</button>
                            </>
                          )}
                          {r.status === 'APPROVED' && <button type="button" className="btn btn-primary btn-sm" onClick={() => openForm(r)}><Truck aria-hidden /> Kirim</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Kiriman drum ke site</div>
          <span className="card-subtitle">Site mengonfirmasi jumlah yang tiba lewat web BBM; selisih ditandai merah</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>No.</th><th>Site</th><th>Dikirim</th><th className="num">Dikirim</th><th className="num">Harga/L</th><th>Sopir</th><th>Status</th><th className="num">Diterima</th><th className="num">Aksi</th></tr>
            </thead>
            <tbody>
              {data.shipments.length === 0 && <EmptyRow colSpan={9} title="Belum ada kiriman" />}
              {data.shipments.map((s) => {
                const short = s.status === 'RECEIVED' && (s.receivedLiters < s.liters * 0.995 || s.receivedDrums < s.drums || !s.sealIntact);
                return (
                  <tr key={s.id}>
                    <td className="cell-title">{s.number}{s.sealNumbers && <div className="cell-sub">Segel {s.sealNumbers}</div>}</td>
                    <td>{s.project.code}<div className="cell-sub">{s.project.name}</div></td>
                    <td className="nowrap">{dateTime(s.sentAt)}<div className="cell-sub">{s.sender.name}</div></td>
                    <td className="num">{s.drums} drum<div className="cell-sub">{liters(s.liters)}</div></td>
                    <td className="num">{idr(s.pricePerLiter)}</td>
                    <td>{s.driver ?? '-'}<div className="cell-sub">{s.plateNumber}</div></td>
                    <td><StatusBadge value={s.status} labels={SHIPMENT_STATUS} tones={SHIPMENT_TONE} /></td>
                    <td className="num">
                      {s.status === 'RECEIVED' ? (
                        <>
                          <span className={short ? 'text-danger' : ''} style={{ fontWeight: 600 }}>{s.receivedDrums} drum · {liters(s.receivedLiters)}</span>
                          <div className="cell-sub">{dateTime(s.receivedAt)} · {s.receiver?.name}{s.sealIntact ? '' : ' · segel rusak'}</div>
                          {s.receiveNotes && <div className="cell-sub">{s.receiveNotes}</div>}
                        </>
                      ) : '-'}
                    </td>
                    <td>{canEdit && s.status === 'SENT' && <div className="row-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={() => cancel(s)}><Ban aria-hidden /> Batalkan</button></div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal
          title="Kirim drum BBM ke site"
          subtitle="Site akan mengonfirmasi jumlah drum dan liter yang tiba."
          onClose={() => setForm(null)}
          busy={busy}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setForm(null)} disabled={busy}>Batal</button>
              <button type="submit" form="shipment-form" className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Catat pengiriman'}</button>
            </>
          }
        >
          <form id="shipment-form" onSubmit={submit} className="form-stack">
            {error && <div className="alert alert-danger" role="alert"><AlertTriangle aria-hidden /> {error}</div>}
            <div className="form-group">
              <label className="form-label required" htmlFor="sh-site">Site tujuan</label>
              <select id="sh-site" className="form-select" value={form.projectId} onChange={set('projectId')} required disabled={Boolean(form.requestId)}>
                <option value="">Pilih site</option>
                {data.projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </select>
              {form.requestId && <p className="form-hint">Dari pengajuan {data.requests.find((r) => r.id === form.requestId)?.number}.</p>}
            </div>
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label required" htmlFor="sh-drums">Jumlah drum</label>
                <input id="sh-drums" type="number" min="1" step="1" className="form-input" value={form.drums} required
                  onChange={(e) => setForm({ ...form, drums: e.target.value, liters: e.target.value ? String(Number(e.target.value) * DRUM_LITERS) : '' })} />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="sh-liters">Total liter</label>
                <input id="sh-liters" type="number" min="1" step="0.1" className="form-input" value={form.liters} onChange={set('liters')} required />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="sh-price">Harga per liter (Rp)</label>
                <input id="sh-price" type="number" min="1" step="0.01" className="form-input" value={form.pricePerLiter} onChange={set('pricePerLiter')} required />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="sh-driver">Sopir</label>
                <input id="sh-driver" className="form-input" value={form.driver} onChange={set('driver')} maxLength={120} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="sh-plate">Nomor polisi</label>
                <input id="sh-plate" className="form-input" value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value.toUpperCase() })} maxLength={40} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sh-seal">Nomor segel drum</label>
              <input id="sh-seal" className="form-input" value={form.sealNumbers} onChange={set('sealNumbers')} placeholder="mis. 102341–102350" maxLength={1000} />
              <p className="form-hint">Ditampilkan ke petugas BBM untuk dicocokkan saat drum tiba.</p>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sh-notes">Catatan</label>
              <input id="sh-notes" className="form-input" value={form.notes} onChange={set('notes')} maxLength={1000} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Anomali ────────────────────────────────────────────────────────────────
function Anomalies({ anomalies }) {
  const [level, setLevel] = useState('all');
  const shown = anomalies.filter((a) => level === 'all' || a.severity === level);
  const count = (s) => anomalies.filter((a) => a.severity === s).length;
  return (
    <div className="stack">
      <div className="tabs-bar" role="tablist">
        {[['all', `Semua (${anomalies.length})`], ['high', `Tinggi (${count('high')})`], ['medium', `Sedang (${count('medium')})`], ['info', `Info (${count('info')})`]].map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={level === key} className={level === key ? 'active' : ''} onClick={() => setLevel(key)}>{label}</button>
        ))}
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Anomali BBM drum</div>
          <span className="card-subtitle">Kiriman kurang, selisih opname, meter mundur, pemakaian boros, pengambilan besar & tanpa kartu, pengambil dengan MCU/SIMPER tidak berlaku (90 hari)</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Tingkat</th><th>Site</th><th>Waktu</th><th>Temuan</th></tr></thead>
            <tbody>
              {shown.length === 0 && <EmptyRow colSpan={4} title="Tidak ada anomali" hint="Semua catatan BBM dalam batas wajar." />}
              {shown.map((a, index) => (
                <tr key={a.kind + (a.ref ?? '') + index}>
                  <td><StatusBadge value={a.severity} labels={Object.fromEntries(Object.entries(SEVERITY).map(([k, v]) => [k, v[0]]))} tones={Object.fromEntries(Object.entries(SEVERITY).map(([k, v]) => [k, v[1]]))} /></td>
                  <td>{a.project}</td>
                  <td className="nowrap">{fmtDate(a.at)}</td>
                  <td><div className="cell-title">{a.title}</div><div className="cell-sub">{a.detail}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
