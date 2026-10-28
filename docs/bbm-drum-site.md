# BBM Drum Site — Pencatatan Anti-Fraud

Sejak 2026-10-24 BBM (solar) yang dikirim HO ke site dalam drum dicatat dari kirim sampai habis. Petugas BBM site
mencatat lewat web HP `/bbm` (bisa offline), Logistik HO memantau di **Logistik & Kendaraan**. Setiap pengambilan
masuk ke `FuelLog` yang sama dengan log BBM lama, jadi biaya BBM proyek dan monitoring per kendaraan ikut terisi.

## Alur

| Langkah | Siapa | Di mana |
|---|---|---|
| Ajukan drum | Petugas BBM | `/bbm` → **Ajukan drum**. Stok, pemakaian 14 hari dan tanggal opname terakhir disalin sistem ke pengajuan. Hanya satu pengajuan terbuka per site. |
| Setujui / tolak | Logistik / Top Management | Logistik → **Kiriman & pengajuan BBM**. |
| Kirim drum | Logistik / Top Management | Tombol **Kirim** (dari pengajuan) atau **Kirim drum ke site**: jumlah drum, total liter, harga per liter, sopir, nomor polisi, nomor segel. |
| Terima | Petugas BBM | `/bbm` → **Terima kiriman**: hitung drum & liter yang tiba, cek segel. Kurang > 0,5 %, drum kurang atau segel rusak wajib diberi keterangan. Stok site bertambah sebesar yang **diterima**, bukan yang dikirim. |
| Keluarkan BBM | Petugas BBM | `/bbm` → **Keluarkan BBM**: scan kartu QR absensi pengambil → pilih unit → HM/km → liter → cara takar (flow meter / takaran / perkiraan) → foto meter (opsional). |
| Opname mingguan | Petugas BBM | `/bbm` → **Opname**: jumlah drum penuh + isi tiap drum terbuka. |
| Pantau | Logistik / Top Management / PJO | Logistik → **Stok BBM site** dan **Anomali BBM**. |

## Aturan stok

- **Stok site = hasil opname terakhir + diterima − dikeluarkan sesudahnya** (sebelum ada opname, patokannya 0).
  Logikanya ada di `fuelLedger` (`src/lib/fuel.js`) dan dipakai oleh server, HP, dan dashboard.
- Setiap opname dibandingkan dengan stok sistem saat itu. Selisih wajar: maks. **2 %** dari BBM keluar sejak opname
  sebelumnya, minimal **10 L** (`COUNT_TOLERANCE`, `COUNT_TOLERANCE_MIN_LITERS`). Di luar itu ditandai merah.
- Satu drum = **200 L** (`DRUM_LITERS`) untuk menghitung drum penuh saat opname. Total liter kiriman tetap diisi HO.
- Biaya pengambilan = liter × rata-rata tertimbang harga per liter dari kiriman yang sudah diterima site.
- Catatan pengambilan tidak bisa diubah atau dihapus. Logistik HO dapat **membatalkan** catatan salah input dengan
  alasan; catatan tetap tersimpan, tercatat di audit log, dan tidak dihitung di stok. Membatalkan catatan sebelum
  sebuah opname akan memperbesar selisih opname itu, karena BBM-nya dianggap tidak pernah keluar.

## Pemeriksaan otomatis (tab Anomali BBM)

| Temuan | Tingkat |
|---|---|
| Kiriman diterima kurang dari yang dikirim, drum kurang, atau segel rusak | Tinggi |
| Opname kurang dari stok sistem melebihi batas wajar | Tinggi (lebih: Sedang) |
| HM/km mundur dibanding pengisian sebelumnya | Tinggi |
| Stok sistem minus (keluar lebih banyak dari yang diterima) | Tinggi |
| Rasio pemakaian unit (L/HM, L/km, L/jam nyala) > 1,5× median unit itu, minimal 4 data | Sedang |
| Satu pengambilan > 200 L | Sedang |
| Opname terakhir lebih dari 7 hari lalu / belum pernah | Sedang |
| Pengambil tanpa kartu QR (subkon/tamu) | Info |
| Pengambil dengan MCU UNFIT/kedaluwarsa, atau tanpa SIMPER/KIMPER yang berlaku di site ini untuk alat berat/kendaraan | Sedang |

Dashboard stok juga menampilkan pengambil terbanyak 30 hari dan porsi pengambilan bercara *perkiraan* per site.

## Tanda HSE pengambil

Pengambil dengan MCU tidak berlaku atau SIMPER/KIMPER kedaluwarsa **tetap bisa mengambil BBM** (ada kasus tertentu);
catatannya ditandai (`FuelLog.hseFlags`), HP petugas menampilkan "Catatan HSE", dan Logistik melihatnya di Anomali BBM.
SIMPER/KIMPER hanya diperiksa untuk unit alat berat dan kendaraan, dan harus berlaku pada tanggal pengambilan untuk
site E-HSE proyek ini (SIMPER tambang berlaku per site). Data dari E-HSE; aturan di `src/lib/hse-flags.js`.

## Validasi saat mencatat

- Pengambil wajib kartu QR absensi resmi (tanda tangan diperiksa server) atau, bila tanpa kartu, nama lengkap.
- HM wajib untuk alat berat, km untuk kendaraan. Genset boleh tanpa HM bila diganti *lama nyala (jam)*. Alat kecil
  (`ALAT_KECIL`: pompa air, kompresor, mesin las) tanpa meter.
- HM/km tidak boleh lebih kecil dari pengisian sebelumnya, atau lebih besar dari pengisian sesudahnya (antrean
  offline bisa tiba tidak berurutan).
- Pengambilan maks. 1.000 L; di atas 200 L petugas diminta konfirmasi.

## Akun petugas BBM

Menu **Pengguna** → peran *Petugas BBM site* (`FUELMAN`) → pilih **site tempat bertugas** (wajib). Akun ini hanya bisa
membuka `/bbm`, dan semua catatannya otomatis masuk ke site tersebut. Usahakan petugas BBM bukan operator unit, dan
drum disimpan terkunci sehingga hanya petugas yang mengeluarkan BBM.

## Offline

Sama seperti web absensi (docs/absensi-barcode.md): setiap catatan masuk antrean di HP (localStorage, per akun)
dengan id unik lalu dikirim ke `POST /api/bbm/sync`; pengiriman ulang tidak mencatat dua kali. Daftar unit,
karyawan aktif, kiriman dalam perjalanan dan stok disimpan di HP dari `GET /api/bbm/context`. Jam HP dikoreksi
terhadap jam server; catatan offline lebih dari **7 hari** ditolak. Foto meter dikompres di HP (± ≤ 150 KB) dan dihapus
dari HP setelah terkirim. Service worker `public/absen-sw.js` kini dipakai untuk `/absen` dan `/bbm` (cache per
halaman).

## Rilis

1. Backup, lalu jalankan migrasi `20261024000000_fuel_drum_stock` (aditif: kolom baru di `User`, `FuelLog`; tabel
   `FuelShipment`, `FuelStockCount`, `FuelRequest`, `FuelPhoto`; hak akses runtime ikut diberikan).
2. Deploy. Buat akun petugas BBM per site di menu **Pengguna**, daftarkan unit/genset/alat kecil di
   Logistik → **Kendaraan & alat berat**.
3. Pastikan karyawan yang mengambil BBM sudah punya kartu QR absensi.
4. Lakukan opname pertama di setiap site sebagai patokan stok awal.
