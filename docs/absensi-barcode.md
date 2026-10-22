# Absensi Barcode (Kartu QR)

Sejak 2026-10-22 kehadiran dapat dicatat dengan memindai kartu QR karyawan di kiosk `/absen`.
Data masuk ke tabel yang sama dengan absensi manual, jadi langsung terpakai di rekap SDM dan payroll.

## Alur

| Langkah | Penjelasan |
|---|---|
| Cetak kartu | SDM → **Kartu QR absensi** (HRD/Top Management). Satu kartu ukuran ID (85,6 × 54 mm) per karyawan aktif, filter per proyek atau nama/kode. |
| Pasang kiosk | Laptop/tablet login dengan akun peran **Kiosk absensi** (`ABSENSI`), pilih proyek & zona waktu sekali. HRD/PJO/Top Management juga bisa membuka `/absen`. |
| Scan | Scanner barcode USB (mengetik isi QR + Enter) atau tombol **Scan dengan kamera**. |
| Rekap | SDM → **Rekap scan barcode**: jam setiap scan, jumlah, status lengkap/kurang, dan daftar karyawan yang ditugaskan tetapi belum scan. |

## Aturan

- Scan pertama per hari membuat `Attendance` **HADIR** pada proyek kiosk (dasar payroll); scan berikutnya hanya menambah log jam (`AttendanceScan`).
- Kehadiran lengkap bila minimal 3× scan (`MIN_SCANS` di `src/lib/attendance-scan.js`).
- Scan ulang kartu yang sama dalam 2 menit diabaikan.
- Ditolak bila: kartu tidak sah, karyawan nonaktif, tidak ditugaskan di proyek kiosk pada tanggal itu, sudah hadir di proyek lain hari itu, tercatat izin/sakit/libur, atau payroll periode tersebut sudah dibuat.
- Tanggal mengikuti zona waktu kiosk (WIB/WITA/WIT); jam diambil dari server, bukan dari perangkat.

## Keamanan kartu

Isi QR: `PRHB1.<kode karyawan>.<tanda tangan HMAC>`. Tanpa `ATTENDANCE_QR_SECRET`, QR tidak bisa dibuat sendiri
dari kode karyawan orang lain. Kartu cetak ulang identik dengan kartu lama. **Jangan ganti secret setelah kartu
dicetak** — semua kartu lama menjadi tidak sah dan harus dicetak ulang. Nama karyawan tampil besar di layar
kiosk setiap scan agar petugas dapat melihat bila kartu dipakai orang lain.

## Rilis

1. Backup, lalu jalankan migrasi `20261022000000_attendance_scan` (aditif; memberi hak akses runtime ke tabel baru).
2. Set `ATTENDANCE_QR_SECRET` (≥ 32 karakter acak, berbeda untuk development/produksi):
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
3. Deploy. Buat akun kiosk di menu **Pengguna** dengan peran *Kiosk absensi (perangkat scan)*.
4. Kamera hanya bekerja lewat HTTPS (atau localhost); header `Permissions-Policy` mengizinkan kamera khusus di `/absen`.
