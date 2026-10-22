# Absensi Barcode (Kartu QR) — Web Absensi Lapangan

Sejak 2026-10-22 kehadiran dicatat oleh **PIC absensi lapangan** yang berkeliling dan memindai kartu QR setiap
karyawan dengan HP lewat web sederhana `/absen`. Data masuk ke tabel yang sama dengan absensi manual ERP,
jadi langsung terpakai di rekap SDM dan payroll.

## Alur

| Langkah | Penjelasan |
|---|---|
| Cetak kartu | SDM → **Kartu QR absensi** (HRD/Top Management). Satu kartu ukuran ID (85,6 × 54 mm) per karyawan aktif **yang sudah ber-NIP**, filter per proyek atau nama/NIP. Karyawan tanpa NIP dihitung dan ditautkan ke Master Data untuk dilengkapi. |
| Akun PIC | Menu **Pengguna** → peran *PIC absensi lapangan* (`ABSENSI`), satu akun per PIC. Akun ini hanya bisa membuka `/absen`. HRD/PJO/Top Management juga bisa membuka `/absen`. |
| Pasang di HP | PIC login di HP, buka `/absen` sekali saat ada sinyal, lalu (opsional) *Tambahkan ke layar utama*. Setelah itu web tetap terbuka walau tanpa sinyal. |
| Scan | Kamera langsung aktif; arahkan ke kartu, scan berikutnya otomatis. Scanner Bluetooth/USB (mode keyboard) juga diterima. |
| Rekap | SDM → **Rekap scan barcode**: jam setiap scan, PIC yang men-scan, tanda *offline*, status lengkap/kurang, dan karyawan yang ditugaskan tetapi belum scan. |

## Aturan

- **Proyek otomatis** dari penugasan karyawan pada tanggal scan (Master Data → Penugasan). Bila karyawan punya lebih dari
  satu penugasan aktif, penugasan dengan tanggal mulai terbaru dipakai. Proyek hari itu ditentukan scan pertama.
- Scan pertama per hari membuat `Attendance` **HADIR** (dasar payroll); scan berikutnya hanya menambah log jam (`AttendanceScan`).
- Kehadiran lengkap bila minimal 3× scan (`MIN_SCANS` di `src/lib/attendance-scan.js`).
- Scan kartu yang sama dalam 2 menit dianggap scan ganda dan tidak dihitung.
- Ditolak bila: kartu tidak sah, karyawan nonaktif, tidak punya penugasan aktif pada tanggal itu, tercatat izin/sakit/libur,
  atau payroll proyek periode tersebut sudah dibuat. Alasan penolakan tampil merah di daftar scan HP PIC.

## Offline

- Setiap scan masuk antrean di HP (localStorage, per akun PIC) dengan id unik, lalu dikirim ke `POST /api/absen/sync`.
  Tanpa sinyal, antrean tetap tersimpan (juga bila HP/peramban ditutup) dan dikirim otomatis saat sinyal kembali,
  saat web dibuka lagi, atau setiap 20 detik. Pengiriman ulang aman: id yang sama tidak dicatat dua kali.
- Nama karyawan tetap tampil saat offline dari daftar karyawan aktif yang disimpan di HP (`GET /api/absen/roster`,
  hanya kode, nama dan jabatan).
- Jam scan memakai jam HP yang **dikoreksi** selisihnya terhadap jam server saat dikirim, jadi jam HP yang salah tidak
  menggeser jam absensi. Scan offline lebih dari 3 hari ditolak. Rekap menandai scan yang diterima server > 2 menit
  setelah di-scan sebagai *offline* (arahkan kursor untuk melihat kapan terkirim).
- Service worker `public/absen-sw.js` (hanya build produksi) menyimpan halaman `/absen` dan aset build agar web terbuka
  tanpa sinyal. Syaratnya PIC pernah membuka `/absen` sekali saat online setelah rilis.
- Sesi login berlaku 8 jam. Bila habis, scan tetap tersimpan; PIC login ulang dan antrean terkirim.

## NIP dan isi QR

Kartu, layar scan dan rekap menampilkan **NIP** (`Employee.nip`, dari E-HSE); kode internal (`PJM-…`) tidak ditampilkan.
QR berisi kode internal karena kode itu tetap dan unik, sedangkan NIP boleh kosong dan dapat diubah HRD. Akibatnya
kartu tetap berlaku walau NIP diubah; cetak ulang bila NIP pada kartu perlu diperbarui.

## Keamanan kartu

Isi QR: `PRHB1.<kode internal>.<tanda tangan HMAC>`. Tanpa `ATTENDANCE_QR_SECRET`, QR tidak bisa dibuat sendiri
dari kode karyawan orang lain. Kartu cetak ulang identik dengan kartu lama. **Jangan ganti secret setelah kartu
dicetak** — semua kartu lama menjadi tidak sah dan harus dicetak ulang. Tanda tangan hanya diperiksa server: saat
offline HP menerima QR berformat benar, lalu kartu palsu ditolak ketika antrean terkirim. Nama karyawan tampil besar
setiap scan agar PIC dapat melihat bila kartu dipakai orang lain.

## Rilis

1. Backup, lalu jalankan migrasi `20261022000000_attendance_scan` dan `20261023000000_attendance_scan_offline`
   (aditif; memberi hak akses runtime ke tabel baru).
2. Set `ATTENDANCE_QR_SECRET` (≥ 32 karakter acak, berbeda untuk development/produksi):
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
3. Opsional domain khusus: tambahkan domain (mis. `absen.prohaba.co.id`) ke proyek Vercel yang sama dan set
   `ABSEN_HOST=absen.prohaba.co.id`; membuka domain itu langsung ke login → `/absen`.
4. Deploy. Buat akun PIC di menu **Pengguna** dengan peran *PIC absensi lapangan*.
5. Kamera hanya bekerja lewat HTTPS (atau localhost); header `Permissions-Policy` mengizinkan kamera khusus di `/absen`.
