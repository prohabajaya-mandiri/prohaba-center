'use client';
import { apiFetch } from '@/lib/client-api';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, Droplet, Wrench, Plus, History, Info, X, BarChart2 } from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';
import MonitoringClient from './MonitoringClient';
import { EmptyRow, Modal, StatusBadge } from '@/components/ui';
import { MAINTENANCE_TYPE, VEHICLE_TYPE, fmtDate } from '@/lib/ui-labels';

export default function LogistikClient({ tab: activeTab = 'fuel', user, vehicles, fuelLogs, maintenanceLogs, projects }) {
  const router = useRouter();
  
  // Add Vehicle State
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [vCode, setVCode] = useState('');
  const [vName, setVName] = useState('');
  const [vType, setVType] = useState('KENDARAAN');
  const [vPlate, setVPlate] = useState('');
  
  // Fuel Log State
  const [vehicleId, setVehicleId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [fuelType, setFuelType] = useState('SOLAR');
  const [liters, setLiters] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [meterValue, setMeterValue] = useState('');
  const [operator, setOperator] = useState('');
  
  // Maintenance Log State
  const [mVehId, setMVehId] = useState('');
  const [mProjId, setMProjId] = useState('');
  const [mType, setMType] = useState('SERVICE');
  const [mDesc, setMDesc] = useState('');
  const [mCost, setMCost] = useState('');
  const [mMeter, setMMeter] = useState('');
  const [mMechanic, setMMechanic] = useState('');
  const [mPartName, setMPartName] = useState('');
  const [mNextMeter, setMNextMeter] = useState('');
  const [mNextDate, setMNextDate] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showAlert } = useDialog();

  const handleVehicleSubmit = async (e) => {
    e.preventDefault();
    if (!vName || !vType) {
      await showAlert('Nama Alat dan Tipe wajib diisi.', 'Peringatan');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/logistik/vehicle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: vCode, name: vName, type: vType, plateNumber: vPlate, status: 'ACTIVE' })
      });
      if (!res.ok) throw new Error('Gagal menyimpan kendaraan');
      await showAlert('Kendaraan berhasil ditambahkan!', 'Sukses');
      setIsVehicleModalOpen(false);
      setVCode('');
      setVName('');
      setVPlate('');
      router.refresh();
    } catch (err) {
      await showAlert(err.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMaintenanceSubmit = async (e) => {
    e.preventDefault();
    if (!mVehId || !mType || !mDesc || !mCost) {
      await showAlert('Lengkapi data wajib (Kendaraan, Jenis, Deskripsi, Biaya)', 'Peringatan');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/logistik/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: mVehId,
          projectId: mProjId || null,
          type: mType,
          description: mDesc,
          cost: parseFloat(mCost),
          meterValue: mMeter ? parseFloat(mMeter) : null,
          mechanic: mMechanic,
          partName: mPartName || null,
          nextServiceMeter: mNextMeter ? parseFloat(mNextMeter) : null,
          nextServiceDate: mNextDate ? mNextDate : null
        })
      });

      if (!res.ok) throw new Error('Gagal menyimpan log servis');

      await showAlert('Data servis berhasil ditambahkan!', 'Sukses');
      
      // Reset
      setMVehId('');
      setMProjId('');
      setMDesc('');
      setMCost('');
      setMMeter('');
      setMMechanic('');
      setMPartName('');
      setMNextMeter('');
      setMNextDate('');
      router.refresh();
      
    } catch (err) {
      await showAlert(err.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFuelSubmit = async (e) => {
    e.preventDefault();
    if (!vehicleId || !fuelType || !liters || !totalCost) {
      await showAlert('Lengkapi data wajib (Kendaraan, Jenis BBM, Liter, Biaya)', 'Peringatan');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/logistik/fuel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          projectId: projectId || null,
          fuelType,
          liters: parseFloat(liters),
          totalCost: parseFloat(totalCost),
          meterValue: meterValue ? parseFloat(meterValue) : null,
          operator
        })
      });

      if (!res.ok) throw new Error('Gagal menyimpan log BBM');

      await showAlert('Log BBM berhasil ditambahkan!', 'Sukses');
      
      // Reset
      setVehicleId('');
      setProjectId('');
      setLiters('');
      setTotalCost('');
      setMeterValue('');
      setOperator('');
      router.refresh();
      
    } catch (err) {
      await showAlert(err.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
  };

  return (
    <div className="stack">
      {activeTab === 'monitoring' && (
        <p className="muted" style={{ fontSize: 14 }}>Ringkasan pemakaian dan deteksi anomali dihitung dari 50 catatan BBM dan servis terbaru.</p>
      )}

      {activeTab === 'fuel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Form Input BBM */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Input Pemakaian BBM</div>
            </div>
            <div className="card-body">
              <form onSubmit={handleFuelSubmit}>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label required">Kendaraan / Alat Berat</label>
                    <select className="form-select" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                      <option value="">-- Pilih Kendaraan --</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.name} ({v.code || v.plateNumber})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Proyek (Opsional)</label>
                    <select className="form-select" value={projectId} onChange={e => setProjectId(e.target.value)}>
                      <option value="">-- Kantor Pusat / Gudang --</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Jenis BBM</label>
                    <select className="form-select" value={fuelType} onChange={e => setFuelType(e.target.value)}>
                      <option value="SOLAR">Solar</option>
                      <option value="DEXLITE">Dexlite</option>
                      <option value="PERTAMAX">Pertamax</option>
                      <option value="PERTALITE">Pertalite</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Jumlah (Liter)</label>
                    <input type="number" className="form-input" value={liters} onChange={e => setLiters(e.target.value)} placeholder="100" />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Total Biaya (Rp)</label>
                    <input type="number" className="form-input" value={totalCost} onChange={e => setTotalCost(e.target.value)} placeholder="Rp..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">HM / Odometer</label>
                    <input type="number" className="form-input" value={meterValue} onChange={e => setMeterValue(e.target.value)} placeholder="Angka km/HM" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Operator / Supir</label>
                    <input type="text" className="form-input" value={operator} onChange={e => setOperator(e.target.value)} placeholder="Nama..." />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  <Droplet size={16} />
                  Simpan Log BBM
                </button>
              </form>
            </div>
          </div>

          {/* Tabel History BBM */}
          <div className="card" style={{ marginTop: '4px' }}>
            <div className="card-header" style={{ borderBottom: '1px solid var(--gray-100)', paddingBottom: '16px' }}>
              <div className="card-title">Riwayat Pemakaian BBM</div>
              <span className="card-subtitle">Semua kendaraan, terbaru di atas</span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Kendaraan</th>
                    <th>Proyek</th>
                    <th>BBM</th>
                    <th>Total Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {fuelLogs.length === 0 ? (
                    <EmptyRow colSpan={5} title="Belum ada riwayat BBM" />
                  ) : (
                    fuelLogs.map(log => (
                      <tr key={log.id} style={log.voidedAt ? { opacity: 0.55 } : undefined}>
                        <td className="nowrap">{fmtDate(log.date)}</td>
                        <td><div className="cell-title">{log.vehicle.name}</div><div className="cell-sub">{log.vehicle.code || log.vehicle.plateNumber || '-'}</div></td>
                        <td>{log.project?.code || '-'}</td>
                        <td>
                          {log.liters}L <span className="badge badge-gray">{log.fuelType}</span>
                          {log.source === 'DRUM' && <div className="cell-sub">Drum site · {log.operator}{log.voidedAt ? ' · dibatalkan' : ''}</div>}
                        </td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(log.totalCost)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Form Input Maintenance */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Input Perawatan & Servis</div>
            </div>
            <div className="card-body">
              <form onSubmit={handleMaintenanceSubmit}>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label required">Kendaraan / Alat Berat</label>
                    <select className="form-select" value={mVehId} onChange={e => setMVehId(e.target.value)}>
                      <option value="">-- Pilih Kendaraan --</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.name} ({v.code || v.plateNumber})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Proyek (Opsional)</label>
                    <select className="form-select" value={mProjId} onChange={e => setMProjId(e.target.value)}>
                      <option value="">-- Kantor Pusat / Gudang --</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Jenis Servis</label>
                    <select className="form-select" value={mType} onChange={e => setMType(e.target.value)}>
                      <option value="SERVICE">Servis Rutin</option>
                      <option value="GANTI_OLI">Ganti Oli</option>
                      <option value="SPAREPART">Penggantian Sparepart</option>
                      <option value="REPAIR">Perbaikan / Repair</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label required">Deskripsi / Detail Pekerjaan</label>
                    <input type="text" className="form-input" value={mDesc} onChange={e => setMDesc(e.target.value)} placeholder="Misal: Ganti kampas rem belakang, filter solar..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Total Biaya (Rp)</label>
                    <input type="number" className="form-input" value={mCost} onChange={e => setMCost(e.target.value)} placeholder="Rp..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">HM / Odometer</label>
                    <input type="number" className="form-input" value={mMeter} onChange={e => setMMeter(e.target.value)} placeholder="Angka km/HM" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mekanik / Bengkel</label>
                    <input type="text" className="form-input" value={mMechanic} onChange={e => setMMechanic(e.target.value)} placeholder="Nama bengkel..." />
                  </div>
                  {mType === 'SPAREPART' && (
                    <div className="form-group">
                      <label className="form-label">Nama Sparepart</label>
                      <input type="text" className="form-input" value={mPartName} onChange={e => setMPartName(e.target.value)} placeholder="Misal: Filter Solar, Kampas Rem..." />
                    </div>
                  )}
                </div>

                <div style={{ background: 'var(--gray-50)', borderRadius: '10px', padding: '16px', border: '1px dashed var(--gray-200)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Target Servis Berikutnya</div>
                  <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Target HM / km</label>
                      <input type="number" className="form-input" value={mNextMeter} onChange={e => setMNextMeter(e.target.value)} placeholder="Misal: 1500 (HM)" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Target Tanggal</label>
                      <input type="date" className="form-input" value={mNextDate} onChange={e => setMNextDate(e.target.value)} />
                    </div>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  <Wrench size={16} />
                  Simpan Data Servis
                </button>
              </form>
            </div>
          </div>

          {/* Tabel History Maintenance */}
          <div className="card" style={{ marginTop: '4px' }}>
            <div className="card-header" style={{ borderBottom: '1px solid var(--gray-100)' }}>
              <div className="card-title">Riwayat Perawatan</div>
              <span className="card-subtitle">Semua kendaraan, terbaru di atas</span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Kendaraan</th>
                    <th>Jenis</th>
                    <th>Deskripsi</th>
                    <th>Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceLogs.length === 0 ? (
                    <EmptyRow colSpan={5} title="Belum ada riwayat servis" />
                  ) : (
                    maintenanceLogs.map(log => (
                      <tr key={log.id}>
                        <td className="nowrap">{fmtDate(log.date)}</td>
                        <td><div className="cell-title">{log.vehicle.name}</div><div className="cell-sub">{log.vehicle.code || log.vehicle.plateNumber || '-'}</div></td>
                        <td><span className="badge badge-info">{MAINTENANCE_TYPE[log.type] ?? log.type}</span></td>
                        <td style={{ maxWidth: '200px' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.description}>
                            {log.description}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(log.cost)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'vehicles' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title">Daftar Aset / Kendaraan</div>
            <button className="btn btn-primary btn-sm" onClick={() => setIsVehicleModalOpen(true)}>Tambah Data</button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Kendaraan / Alat</th>
                  <th>Tipe</th>
                  <th>Nomor Polisi</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 && <EmptyRow colSpan={5} title="Belum ada kendaraan / alat berat" hint="Klik Tambah data untuk mendaftarkan." />}
                {vehicles.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600, color: 'var(--navy-700)' }}>{v.code || '-'}</td>
                    <td style={{ fontWeight: 500 }}>{v.name}</td>
                    <td>{VEHICLE_TYPE[v.type] ?? v.type}</td>
                    <td>{v.plateNumber || '-'}</td>
                    <td><StatusBadge value={v.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {activeTab === 'monitoring' && (
        <MonitoringClient vehicles={vehicles} fuelLogs={fuelLogs.filter((l) => !l.voidedAt)} maintenanceLogs={maintenanceLogs} />
      )}

      {/* Vehicle Modal */}
      {isVehicleModalOpen && (
        <Modal
          title="Tambah kendaraan / alat berat"
          onClose={() => setIsVehicleModalOpen(false)}
          busy={isSubmitting}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setIsVehicleModalOpen(false)} disabled={isSubmitting}>Batal</button>
              <button type="submit" form="vehicle-form" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan…' : 'Simpan data'}</button>
            </>
          }
        >
          <form id="vehicle-form" onSubmit={handleVehicleSubmit} className="form-stack">
            <div className="form-group">
              <label className="form-label required" htmlFor="vh-name">Nama alat / kendaraan</label>
              <input id="vh-name" type="text" className="form-input" value={vName} onChange={e => setVName(e.target.value)} placeholder="Truk Fuso 12 roda" required />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="vh-code">Kode (opsional)</label>
                <input id="vh-code" type="text" className="form-input" value={vCode} onChange={e => setVCode(e.target.value)} placeholder="TRK-001" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="vh-plate">Nomor polisi</label>
                <input id="vh-plate" type="text" className="form-input" value={vPlate} onChange={e => setVPlate(e.target.value.toUpperCase())} placeholder="B 1234 XYZ" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="vh-type">Kategori / tipe</label>
              <select id="vh-type" className="form-select" value={vType} onChange={e => setVType(e.target.value)}>
                <option value="KENDARAAN">Kendaraan (mobil, truk, pick-up)</option>
                <option value="ALAT_BERAT">Alat berat (excavator, buldozer, dll.)</option>
                <option value="GENSET">Genset / alat statis</option>
                <option value="ALAT_KECIL">Alat kecil (pompa air, kompresor, mesin las, dll.)</option>
              </select>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
