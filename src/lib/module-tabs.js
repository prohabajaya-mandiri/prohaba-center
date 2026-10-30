// Sub-menu modul yang tampil di sidebar. Setiap sub-menu adalah tampilan pada
// halaman modulnya, dipilih lewat query string (?tab= atau ?resource=), jadi
// bisa dibuka langsung, dibagikan, dan tetap terpilih saat halaman dimuat ulang.
// Berkas ini aman dipakai di client (tanpa Prisma).

// Peran yang boleh membuka setiap jenis master data. Dipakai juga oleh
// lib/services/master.js sebagai sumber aturan yang sama.
export const MASTER_ROLES = {
  employees: ['TOP_MANAGEMENT', 'HRD'],
  assignments: ['TOP_MANAGEMENT', 'HRD'],
  vendors: ['TOP_MANAGEMENT', 'LOGISTIK', 'FINANCE'],
  prices: ['TOP_MANAGEMENT', 'LOGISTIK', 'FINANCE'],
  accounts: ['TOP_MANAGEMENT', 'FINANCE'],
};

export const MODULE_TABS = {
  '/scurve': {
    param: 'tab',
    items: [
      ['scurve', 'Kurva S'],
      ['boq', 'Upload BOQ'],
      ['schedule', 'Jadwal item'],
      ['actual', 'Input realisasi'],
      ['report', 'Laporan'],
    ],
  },
  '/workshop': {
    param: 'tab',
    items: [
      ['orders', 'Surat perintah kerja'],
      ['cutting', 'Daftar potong'],
      ['delivery', 'Surat jalan'],
    ],
  },
  '/logistik': {
    param: 'tab',
    items: [
      ['bbm-stok', 'Stok BBM site'],
      ['bbm-kirim', 'Kiriman & pengajuan BBM'],
      ['bbm-anomali', 'Anomali BBM'],
      ['fuel', 'Log penggunaan BBM'],
      ['maintenance', 'Perawatan & servis'],
      ['vehicles', 'Kendaraan & alat berat'],
      ['monitoring', 'Monitoring per kendaraan'],
    ],
  },
  '/inventaris': {
    param: 'tab',
    items: [
      ['daftar', 'Daftar aset'],
      ['import', 'Import register', ['TOP_MANAGEMENT', 'LOGISTIK']],
    ],
  },
  '/gudang': {
    param: 'tab',
    items: [
      ['stok', 'Stok barang'],
      ['scan', 'Scan rak'],
      ['transaksi', 'Transaksi & surat jalan'],
      ['laporan', 'Laporan mingguan'],
      ['lokasi', 'Lokasi & label'],
      ['import', 'Import saldo awal', ['TOP_MANAGEMENT', 'LOGISTIK']],
    ],
  },
  '/finance': {
    param: 'tab',
    items: [
      ['hutang', 'Hutang usaha'],
      ['faktur', 'Faktur pembelian baru'],
      ['buku', 'Buku besar'],
      ['laba', 'Laba proyek'],
    ],
  },
  '/hr': {
    param: 'tab',
    items: [
      ['absensi', 'Absensi & koreksi'],
      ['scan', 'Rekap scan barcode'],
      ['kartu', 'Kartu QR absensi', ['TOP_MANAGEMENT', 'HRD']],
    ],
  },
  '/master-data': {
    param: 'resource',
    items: [
      ['employees', 'Karyawan', MASTER_ROLES.employees],
      ['assignments', 'Penugasan & tarif', MASTER_ROLES.assignments],
      ['vendors', 'Pemasok', MASTER_ROLES.vendors],
      ['prices', 'Referensi harga', MASTER_ROLES.prices],
      ['accounts', 'Akun buku besar', MASTER_ROLES.accounts],
    ],
  },
};

/** Sub-menu yang boleh dilihat peran tertentu. */
export function tabsFor(path, role) {
  const config = MODULE_TABS[path];
  if (!config) return [];
  return config.items.filter(([, , roles]) => !roles || roles.includes(role));
}

/** Kunci sub-menu yang valid dari nilai query; jatuh ke sub-menu pertama. */
export function currentTab(path, value, role) {
  const items = tabsFor(path, role);
  return items.some(([key]) => key === value) ? value : items[0]?.[0];
}

/** Label sub-menu untuk subjudul halaman. */
export function tabLabel(path, key) {
  return MODULE_TABS[path]?.items.find(([k]) => k === key)?.[1] ?? '';
}
