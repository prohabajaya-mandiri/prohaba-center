// Label tampilan dan nada badge untuk kode status. Dipusatkan di sini agar satu
// status selalu tampil dengan kata dan warna yang sama di seluruh aplikasi.

export const ROLE_LABELS = {
  TOP_MANAGEMENT: 'Top Management',
  HRD: 'HRD',
  PJO: 'P.J. Operasional',
  LOGISTIK: 'Logistik & Procurement',
  FINANCE: 'Finance',
  ENGINEERING: 'Engineering',
  WORKSHOP: 'Workshop',
  ABSENSI: 'PIC absensi lapangan',
};

export const STATUS = {
  // proyek
  ACTIVE: ['Aktif', 'success'],
  ON_HOLD: ['Ditunda', 'warning'],
  COMPLETED: ['Selesai', 'info'],
  CANCELLED: ['Dibatalkan', 'gray'],
  ARCHIVED: ['Diarsipkan', 'gray'],
  // material request
  DRAFT: ['Draft', 'gray'],
  SUBMITTED: ['Menunggu persetujuan', 'warning'],
  APPROVED: ['Disetujui', 'success'],
  PO_CREATED: ['PO dibuat', 'info'],
  REJECTED: ['Ditolak', 'danger'],
  // purchase order
  CREATED: ['Diterbitkan', 'gray'],
  SENT: ['Terkirim ke vendor', 'info'],
  CONFIRMED: ['Dikonfirmasi', 'navy'],
  PARTIAL: ['Sebagian', 'warning'],
  DELIVERED: ['Diterima lengkap', 'success'],
  INVOICED: ['Sudah difakturkan', 'navy'],
  // faktur
  UNPAID: ['Belum dibayar', 'danger'],
  OVERDUE: ['Lewat jatuh tempo', 'danger'],
  PAID: ['Lunas', 'success'],
  VOID: ['Dibatalkan', 'gray'],
  // pembelian site
  PENDING: ['Menunggu review', 'warning'],
  // workshop
  PLANNED: ['Direncanakan', 'gray'],
  IN_PROGRESS: ['Dikerjakan', 'warning'],
  CUT: ['Selesai potong', 'warning'],
  WELDED: ['Selesai las', 'info'],
  FINISHED: ['Selesai', 'success'],
  IN_TRANSIT: ['Dalam perjalanan', 'info'],
  RECEIVED_AT_SITE: ['Diterima di site', 'success'],
  // payroll
  HRD_APPROVED: ['Disetujui HRD', 'info'],
  FINANCE_APPROVED: ['Disetujui Finance', 'navy'],
  // absensi
  HADIR: ['Hadir', 'success'],
  IZIN: ['Izin', 'info'],
  SAKIT: ['Sakit', 'warning'],
  TIDAK_HADIR: ['Tidak hadir', 'danger'],
  LIBUR: ['Libur', 'gray'],
  // kendaraan
  INACTIVE: ['Tidak aktif', 'gray'],
  MAINTENANCE: ['Perawatan', 'warning'],
};

export const statusLabel = (value) => STATUS[value]?.[0] ?? (value ? String(value).replaceAll('_', ' ') : '-');
export const statusTone = (value) => STATUS[value]?.[1] ?? 'gray';

export const PRIORITY = {
  NORMAL: ['Normal', 'gray'],
  HIGH: ['Tinggi', 'warning'],
  URGENT: ['Mendesak', 'danger'],
};

export const DOC_CATEGORY = {
  DRAWING: ['Gambar kerja', 'info'],
  SPECIFICATION: ['Spesifikasi', 'warning'],
  CALCULATION: ['Kalkulasi', 'navy'],
  REPORT: ['Laporan', 'success'],
};

export const INVOICE_CATEGORY = {
  TERMIN: 'Termin',
  PROGRESS_BILLING: 'Progress billing',
  DP: 'Uang muka',
  RETENTION_RELEASE: 'Pelepasan retensi',
};

export const VEHICLE_TYPE = {
  KENDARAAN: 'Kendaraan',
  ALAT_BERAT: 'Alat berat',
  GENSET: 'Genset / alat statis',
};

export const MAINTENANCE_TYPE = {
  SERVICE: 'Servis rutin',
  GANTI_OLI: 'Ganti oli',
  SPAREPART: 'Sparepart',
  REPAIR: 'Perbaikan',
};

export const initials = (name) =>
  (name || 'U').trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase();

export const idr = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(v ?? 0));

export const fmtDate = (v, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  v ? new Date(v).toLocaleDateString('id-ID', opts) : '-';
