# Inventaris Aset — Rancangan Fase 1

> Status: **rev. 3 (29-10-2026). Fase 1 sedang dibangun:** skema, import register dan daftar aset sudah ada;
> pengajuan, surat jalan, penautan kendaraan dan laporan PDF belum. Rev. 3 menyesuaikan dengan file register lama
> `LIST ASSET PJM 2026 Rev 1.xlsx`. Rev. 2 direvisi dari jawaban kuesioner manajemen
> (templat kosong: `docs/Kuesioner Inventaris Aset.xlsx`; versi terisi diterima 29-10-2026 dari admin aset PJM).
> Poin yang jawabannya bertentangan ada di
> [Pertanyaan terbuka](#pertanyaan-terbuka).

Inventaris = barang berwujud milik perusahaan yang dicatat **per register** (per pembelian). Material, sparepart dan
APD bukan bagian modul ini. APD dikelola Logistik di HO dan HSE di site.

## Prinsip dari jawaban manajemen

1. **Register terpusat di HO.** Hanya admin aset HO yang menerbitkan nomor register dan mengubah data aset di
   sistem. Logistik site mendata, menempel label, lalu mengirim **pengajuan** ke HO.
2. **Kode yang sudah ada dipakai apa adanya.** Label sudah dicetak di percetakan, dan unit besar sudah dipasangi
   nameplate aluminium. Sistem tidak membuat format kode baru.
3. **Satu nomor register = satu unit, dikelompokkan per pembelian.** Di register lama, satu baris pembelian
   (misalnya 10 gerobak) memegang rentang nomor `…/0085 S/D …/0094`. Sistem menyimpan tiap nomor sebagai satu
   aset dengan `batchId` yang sama, dan tampilan mengelompokkannya kembali seperti di Excel. Dengan begitu
   sebagian unit bisa dimutasi tanpa memecah baris. Barang yang hanya punya satu nomor untuk banyak unit
   (misalnya scaffolding) tetap satu aset dengan `quantity` lebih dari 1.
4. **Dokumen fisik tetap berlaku.** Mutasi memakai surat jalan, penambahan memakai nota, dan BAST tetap dibuat.
   Scan QR hanya pelengkap.
5. **Logistik mencatat, end user memelihara.** PJO hanya bisa melihat daftar aset site-nya.

## Cakupan fase 1

| Masuk fase 1 | Fase berikutnya |
|---|---|
| Kategori, golongan penyusutan, lokasi beserta ruangan | Log peminjaman tools & pengingat terlambat via email — fase 2 |
| Import register lama dari Excel | Pengecekan aset karyawan sebelum keluar atau cuti — fase 2 |
| Register aset (per pembelian, dengan jumlah) + foto & dokumen | Dokumen kendaraan & pengingat masa berlaku — fase 3 |
| Pengajuan penambahan & mutasi dari site, dieksekusi HO | Opname 6 bulanan, kehilangan, penghapusan — fase 3 |
| Surat jalan / BAST PDF, konfirmasi penerimaan di site | Penyusutan otomatis (tahunan, ke Capex) — fase 4 |
| Penautan ke `Vehicle` | |
| Laporan daftar aset PDF (harga bisa disembunyikan) + log mutasi | |
| Nilai buku per akhir tahun dihitung otomatis (rumus sama dengan Excel) | |

## Nomor register

```
PJM/MPK/XII/25/0085
 │   │   │   │   └── nomor urut per kategori, tidak di-reset per tahun (MPK sudah sampai 23945), min. 4 digit (VEH: 3)
 │   │   │   └────── tahun beli 2 digit
 │   │   └────────── bulan beli dalam angka Romawi
 │   └────────────── kode kategori: HSE · BT · MPK · OF · VEH
 └────────────────── prefiks perusahaan (PJM; pertanyaan PJM vs PRH terjawab)
```

- Register lama di-import **dengan nomor aslinya**, tanpa diubah. Ada 7 nomor yang bulan/tahunnya berbeda dengan
  tanggal perolehan (misalnya `PJM/MPK/IX/24/0002` dibeli 1-9-2025). Nomor tetap dipakai apa adanya, dan
  perbedaannya hanya ditampilkan sebagai info.
- Untuk aset baru, nomor dibuat sistem saat admin HO mengeksekusi pengajuan penambahan. Bulan dan tahun diambil
  dari tanggal nota, dan nomor urut dari `DocumentSequence` dengan kunci `ASSET-<kategori>`, dimulai dari nomor
  tertinggi hasil import. Pembelian 10 unit langsung mendapat 10 nomor berurutan dan satu `batchId`.
- Lebar nomor urut mengikuti kebiasaan per kategori: VEH 3 digit, kategori lain 4 digit. Nomor yang lebih dari
  9999 tidak dipotong.
- Nomor register **unik dan permanen**. Kalau label rusak, siapa pun boleh mencetak ulang dari nomor register.
  Hanya pencetakan ulang yang tercatat di riwayat, data aset tidak berubah.
- **QR**: label lama kemungkinan tidak memuat QR. Fase 1 tidak bergantung pada QR. Sistem menyediakan cetak stiker
  QR tambahan (berisi URL `/a/<nomor register>`) untuk lokasi yang mau memakainya.

## Tabel

### `AssetCategory` — kategori aset

Register lama hanya punya satu tingkat kategori, yaitu 5 kode di nomor register. Tidak ada subkategori.

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | String (cuid) | |
| `code` | String unik | `HSE`, `BT`, `MPK`, `OF`, `VEH`. Tidak bisa diubah |
| `name` | String | Peralatan HSE · Bangunan / Tanah · Mesin & Peralatan kerja · Peralatan kantor · Kendaraan |
| `seqWidth` | Int | Lebar nomor urut: 3 untuk VEH, 4 untuk lainnya |
| `defaultDepreciationClass` | String? | Golongan bawaan untuk aset baru, misalnya `Gol 1` |
| `isActive` | Boolean | |

Profil `Vehicle` ditentukan per aset, bukan per kategori. VEH berisi kendaraan, sedangkan genset dan alat
ber-BBM lainnya ada di MPK.

### `DepreciationClass` — golongan penyusutan

| Field | Tipe | Keterangan |
|---|---|---|
| `code` | String @id | `Gol 1`, `Gol 2`, `Gol 3`, `Gol 4`, `Tidak Permanen` |
| `rate` | Decimal(6,4) | Tarif per tahun. Bawaan dari register lama: Gol 1 = 25 %, Gol 2 = 12,5 % |

Tarif di register lama tidak selalu sama dengan golongannya (misalnya Gol 1 dengan 12,5 % atau 20 %, Gol 2 dengan
25 %, dan bangunan Gol 4 dengan 12,5 %). Jumlahnya 29 baris. Tarif per baris itu disimpan di aset
(`depreciationRate`) apa adanya, dan ditandai untuk ditinjau keuangan.

### `AssetLocation` — lokasi

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | String (cuid) | |
| `code` | String unik | |
| `name` | String | |
| `type` | String | `HO` \| `SITE` \| `WORKSHOP` \| `GUDANG` \| `MESS` |
| `parentId` | String? → `AssetLocation` | Gudang atau mess di bawah site. Satu site bisa punya lebih dari satu |
| `hseSiteId` | String? | Site E-HSE (satu master site) |
| `isActive` | Boolean | |

Data awal diambil dari daftar isian di register lama: HO, Workshop, Angsana, Lahat, Tabang, Kasongan / Katingan,
KM 19, KM 13, Sampit, Bukit Asam, MAV, Aceh, Meulaboh, Vale/Sorowako, Puruk Cahu. Tabang, Puruk Cahu, MAV, KM 13
dan Aceh tidak disebut di kuesioner, tapi dipakai di data.
**Ruangan atau area** (misalnya Ruang Finance, Mess GL A1 A2, Gudang Logistik) disimpan sebagai teks di aset,
bukan sebagai lokasi tersendiri.

### `Asset` — register aset

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | String (cuid) | |
| `registerNo` | String unik | Nomor register PJM, satu per unit |
| `batchId` | String | Kelompok pembelian. Unit dari satu baris Excel atau satu nota punya `batchId` yang sama |
| `categoryId` | → `AssetCategory` | |
| `name` | String | Kolom NAMA ASET |
| `brandSpec` | String? | Kolom MERK & SPESIFIKASI |
| `identifier` | String? | Kolom PLAT NO / SN / PN. Untuk kendaraan berisi plat, dipakai untuk mencocokkan dengan `Vehicle` |
| `quantity` | Int | Default 1. Lebih dari 1 hanya untuk barang yang punya satu nomor untuk banyak unit |
| `unit` | String? | Kolom UOM: `Unit`, `set`, `pcs` |
| `unitPrice` | Decimal(20,2)? | Kolom HARGA SATUAN (harga beli atau taksiran) |
| `depreciationClass` | String? → `DepreciationClass` | Kolom Golongan Depresiasi |
| `depreciationRate` | Decimal(6,4)? | Kolom Depresiasi (%) per aset. Bisa berbeda dari tarif golongannya |
| `damagedYear` | Int? | Kolom TAHUN RUSAK. Di Excel sebagian berupa angka tahun yang terbaca sebagai tanggal 1905, dan dibetulkan saat import |
| `ownership` | String | `MILIK` \| `TITIPAN` (milik owner proyek atau subkon, dicatat di site) \| `SEWA` (lihat pertanyaan terbuka) |
| `ownerName` | String? | Pemilik barang titipan atau vendor sewa |
| `status` | String | `AKTIF` \| `DALAM_PERBAIKAN` \| `TIDAK_DIPAKAI` (fase 3 menambah `DIHAPUS`) |
| `condition` | String | `BAIK` \| `PERLU_PERBAIKAN` \| `RUSAK` \| `HILANG`. Tiga yang pertama sama dengan pilihan di Excel |
| `locationId` | → `AssetLocation` | |
| `area` | String? | Ruangan atau area. Dianjurkan diisi untuk alat kantor |
| `endUserEmployeeId` | String? → `Employee` | Pemakai yang bertanggung jawab atas pemeliharaan |
| `acquiredAt` | DateTime? | Kolom TAHUN PEROLEHAN (berisi tanggal lengkap) atau tanggal nota |
| `costEstimated` | Boolean | `true` bila harga atau tahun ditaksir. Register lama tidak membedakannya, jadi hasil import di-set `true` |
| `acquisitionSource` | String | `PEMBELIAN` \| `DATA_AWAL` \| `HIBAH` \| `BUATAN_WORKSHOP` |
| `vendorId`, `poId`, `sitePurchaseId` | String? | Asal pembelian bila tercatat di ERP. Pembelian boleh lewat jalur apa saja, jadi semuanya opsional |
| `notes` | String? | Kolom KETERANGAN. Isinya campuran (BARU/BEKAS, ruangan, nama pemakai, catatan mutasi) dan disalin apa adanya |
| `pendingTransferId` | String? | Terisi selama aset ada di mutasi yang belum selesai; mencegah mutasi ganda |
| `createdById` | → `User` | |
| `createdAt`, `updatedAt` | DateTime | |

Indeks: `[locationId, status]`, `[categoryId]`, `[batchId]`, `[endUserEmployeeId]`, `[identifier]`.

Harga dan nilai buku hanya terlihat oleh manajemen, admin aset dan keuangan.

**Nilai buku** dihitung dengan rumus yang sama seperti di Excel, tanpa angka pengali yang diketik manual:

```
nilai buku akhir tahun T = max(0, unitPrice × quantity × (1 − depreciationRate × max(0, T − tahun perolehan)))
```

Penyusutan mulai dihitung tahun setelah perolehan, dengan garis lurus, dan nilainya tidak bisa di bawah 0. Pengali
yang diketik di Excel cocok dengan rumus ini di hampir semua baris. Selisihnya ada di 12 baris yang ditampilkan
saat import.

**Komponen** (bucket, breaker, ban cadangan) tidak punya register sendiri. Komponen dianggap bagian dari unit induk
dan cukup dicatat di `specification`.

### `AssetFile` — foto & dokumen

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | String (cuid) | |
| `assetId` | String? → `Asset` | |
| `requestId` | String? → `AssetRequest` | Lampiran pengajuan (nota, surat jalan yang sudah ditandatangani) |
| `kind` | String | `FOTO_ASET` \| `FAKTUR` \| `MANUAL` \| `SURAT_JALAN` \| `BAST` \| `LAINNYA` |
| `fileName`, `mimeType` | String | Foto dikompres di browser (± ≤ 150 KB). PDF manual disimpan apa adanya, maksimal 10 MB |
| `data` | Bytes | Pola sama dengan `SiteReceipt` dan `FuelPhoto` |
| `uploadedById` | → `User` | |
| `createdAt` | DateTime | |

### `AssetRequest` — pengajuan dari site, dieksekusi HO

Satu tabel untuk semua perubahan yang datang dari site. Dengan begitu HO punya satu antrean kerja, dan setiap
perubahan punya jejak siapa yang mengajukan dan siapa yang mengeksekusi.

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | String (cuid) | |
| `number` | String unik | `PA-2026-000001` (memakai `nextNumber`) |
| `type` | String | `PENAMBAHAN` \| `MUTASI` \| `UBAH_DATA` (kondisi, end user, ruangan) |
| `status` | String | Lihat alur di bawah |
| `fromLocationId`, `toLocationId` | String? → `AssetLocation` | Diisi untuk mutasi |
| `payload` | Json | Isi pengajuan: data aset baru, atau perubahan yang diminta |
| `reason` | String | Wajib |
| `requestedById` | → `User` | |
| `executedById`, `executedAt` | String?, DateTime? | Admin aset HO |
| `rejectReason` | String? | |
| `createdAt`, `updatedAt` | DateTime | |

### `AssetRequestItem` — aset dalam pengajuan mutasi

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | String (cuid) | |
| `requestId` | → `AssetRequest` | |
| `assetId` | → `Asset` | |
| `quantity` | Int | Default seluruh jumlah register. Pemecahan register tidak didukung di fase 1 |
| `conditionOut`, `conditionIn` | String, String? | Kondisi saat dikirim dan saat diterima |

### `AssetApproval` — persetujuan site

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | String (cuid) | |
| `requestId` | → `AssetRequest` | |
| `locationId` | → `AssetLocation` | Site yang menyetujui (asal atau tujuan) |
| `decision` | String | `SETUJU` \| `TOLAK` |
| `decidedById` | → `User` | |
| `note` | String? | |
| `createdAt` | DateTime | |

### `AssetReceipt` — konfirmasi penerimaan mutasi

| Field | Tipe | Keterangan |
|---|---|---|
| `requestId` | String @id → `AssetRequest` | |
| `receivedAt` | DateTime | |
| `receiverEmployeeId` | String? → `Employee` | Supervisor atau HSE site tujuan |
| `receiverName` | String | Wajib, juga ketika karyawan dipilih |
| `method` | String | `INPUT_SITE` (akun site) \| `SCAN_QR` (kartu absensi) \| `DOKUMEN` (HO mengunggah surat jalan bertanda tangan) |
| `recordedById` | → `User` | |

### Perubahan `Vehicle`

| Field | Tipe | Keterangan |
|---|---|---|
| `assetId` | String? unik → `Asset` | Satu register : satu profil kendaraan |
| `clientUnitNo` | String? | Nomor lambung dari client. Penomoran mengikuti client, jadi bisa berbeda per proyek |

Kendaraan **tidak** dibuatkan nomor register baru. Unit di `Vehicle` dicocokkan dengan register hasil import
berdasarkan plat atau nama (lihat [Migrasi](#migrasi-data)).

## Alur pengajuan

```
PENAMBAHAN: Logistik site ajukan (foto, nota, S/N) ──► Admin HO periksa ──► Terbitkan nomor register ──► Site tempel label
                                                         └─► Tolak (alasan)

MUTASI:     Site asal/tujuan ajukan ──► Setuju site asal ──► Setuju site tujuan ──► Admin HO eksekusi
            ──► Cetak surat jalan (nama + nomor register) ──► DIKIRIM ──► Supervisor/HSE tujuan konfirmasi ──► SELESAI
```

| Status | Arti |
|---|---|
| `DIAJUKAN` | Menunggu persetujuan site (mutasi) atau pemeriksaan HO (penambahan, ubah data) |
| `DISETUJUI_SITE` | Semua site terkait setuju. Menunggu eksekusi HO |
| `DIKIRIM` | Surat jalan terbit, aset dalam perjalanan. Lokasi aset belum berubah |
| `SELESAI` | Penambahan: register terbit. Mutasi: penerimaan dikonfirmasi, lokasi dan kondisi aset diperbarui |
| `DITOLAK` / `DIBATALKAN` | Wajib disertai alasan |

- Mutasi yang berstatus `DIKIRIM` lebih dari **7 hari** ditandai **bermasalah** di dashboard admin.
- Pengajuan yang dibuat HO sendiri (misalnya mutasi dari HO) langsung masuk tahap persetujuan site tujuan.
- Admin HO bisa mencatat langsung tanpa pengajuan (registrasi di HO, koreksi). Semua perubahan tercatat di
  `AuditLog` dengan `module = "ASSET"`.

## Hak akses (usulan)

| Peran | Akses |
|---|---|
| **Admin aset HO** (peran baru `ADMIN_ASET`) | Semua: register, import, eksekusi pengajuan, cetak, master data, lihat harga |
| `TOP_MANAGEMENT`, `FINANCE` | Lihat semua, termasuk harga |
| **Logistik site** (lihat pertanyaan terbuka) | Lihat aset site-nya, ajukan penambahan/mutasi/ubah data, setujui mutasi untuk site-nya, konfirmasi penerimaan |
| `PJO` | Lihat daftar aset site-nya, tanpa harga. Bisa melihat dan mengajukan permintaan aset dari site lain |
| Peran lain | Halaman `/a/<nomor register>`: info dasar, tanpa harga |

Pemisahan tugas: admin aset boleh menjadi end user aset, asalkan dengan persetujuan manajemen (jawaban M5). Fase 1
cukup mencatatnya di riwayat; belum ada pemblokiran.

## Alur layar

### Menu **Inventaris Aset** (`/inventaris`)

Tab: **Daftar aset** · **Pengajuan** · **Kategori & lokasi** (admin) · **Import** (admin).

**1. Daftar aset**
- Kartu ringkas per kategori (HSE, BT, MPK, OF, VEH), berisi jumlah nomor register, jumlah unit, dan nilai buku
  (nilai buku hanya untuk peran yang boleh melihat harga).
- Daftar dikelompokkan per pembelian (`batchId`), dan satu kelompok bisa dibuka untuk melihat setiap nomornya.
- Filter: kategori, lokasi, ruangan, kondisi, status, kepemilikan. Pencarian: nomor register, nama, S/N,
  P/N, plat, nomor lambung.
- Logistik site dan PJO otomatis hanya melihat aset di site-nya.
- Aksi admin: **Tambah register**, **Cetak stiker QR**, **Laporan PDF**.
- Aksi site: **Ajukan penambahan**, **Ajukan mutasi** (aset terpilih), **Ajukan ubah data**.

**2. Detail aset** (`/inventaris/<id>`, juga dibuka dari `/a/<nomor register>`)
- Kepala: nomor register, foto, nama, jumlah, kondisi, lokasi, ruangan, end user.
- Tab **Info**, **Foto & dokumen** (faktur, manual, foto S/N), **Riwayat** (log mutasi dan perubahan), dan
  **Kendaraan** (BBM & maintenance) bila aset punya profil kendaraan.

**3. Pengajuan**
- Daftar pengajuan dengan filter status. Mutasi bermasalah (lebih dari 7 hari) diletakkan paling atas.
- **Ajukan penambahan**: kategori → identitas (nama, merek & spesifikasi, plat/S/N/P/N, jumlah, satuan) → lokasi, ruangan, end user
  → harga dan tanggal nota → unggah foto aset dan nota.
- **Ajukan mutasi**: pilih aset → lokasi tujuan → alasan.
- Detail pengajuan menampilkan tombol sesuai peran dan status: **Setujui/Tolak** (site), **Eksekusi** (admin HO),
  **Cetak surat jalan** dan **Cetak BAST**, **Konfirmasi terima** (site tujuan: nama penerima, kondisi tiap aset,
  dan opsional unggah foto surat jalan yang sudah ditandatangani).

**4. Import** (admin)
Templat import = **format register yang sudah dipakai** (`LIST ASSET PJM 2026 Rev 1.xlsx`), jadi admin tidak perlu
mengubah file. Unggah → pratinjau per baris → **Simpan yang valid**. Aturan baca:

- Sheet `HSE`, `BT`, `MPK`, `OF`, `VEH` dibaca. Baris judul dicari dari sel `NO` (posisinya berbeda per sheet:
  baris 9 atau 10), dan data dimulai dua baris di bawahnya.
- Kolom KODE bisa berisi satu nomor, dua nomor (`…/0085   …/0094`), atau rentang (`… S/D …`). Dua nomor
  dianggap rentang bila jumlah nomornya sama dengan QTY. Setiap nomor menjadi satu aset dengan `batchId` baris itu.
- Satu nomor dengan QTY lebih dari 1 menjadi satu aset dengan `quantity` = QTY.
- KONDISI disatukan hurufnya (`BAIK`/`Baik`), dan LOKASI dicocokkan ke master lokasi.
- TAHUN RUSAK yang terbaca sebagai tanggal tahun 1905 dikembalikan ke angka tahunnya (2025, 2026).

Baris berikut **ditahan** sampai admin memperbaikinya (hasil cek terhadap file 29-10-2026):

| Masalah | Jumlah | Contoh |
|---|---|---|
| Rentang nomor tidak sama dengan QTY | 4 baris MPK | Steger QTY 272, rentang `3435 S/D 3459` (25 nomor) |
| Nomor register dipakai dua baris | 0 setelah 4 baris di atas ditahan | Rentang FRAME 190 dan STAIR TANGGA yang salah ketik menimpa nomor baris lain; begitu kedua baris itu ditahan, tidak ada nomor ganda tersisa |
| Kode tidak sesuai pola | 1 baris OF | `PJM/OF/VII/0339` (tanpa tahun) |
| Nama, QTY, tanggal perolehan, harga atau kondisi kosong | 7 baris | Catwalk dan Stair (MPK) tanpa tanggal, harga dan kondisi |
| Kategori di kode berbeda dengan sheet | 1 baris OF | Alat Press Mika |

Hal berikut hanya **ditandai** sebagai info dan tetap di-import: tarif yang tidak sesuai golongan (29 baris), nomor urut yang sama dengan bulan berbeda (HSE `0143` di Apar 6 kg
dan Body Harness),
bulan/tahun di nomor yang berbeda dengan tanggal perolehan (20 baris), dan nilai sisa di Excel yang berbeda
dengan rumus (12 baris). Total hasil uji import file 29-10-2026: **1.138 baris siap (22.630 nomor, 22.634 unit),
12 baris ditahan.**

Hasil hitung dari file: **23.320 unit (jumlah QTY)** dengan **22.997 nomor register unik** (HSE 177, BT 1, MPK
22.419, OF 345, VEH 55). Selisihnya berasal dari baris yang punya satu nomor untuk banyak unit dan dari rentang yang
salah di atas.

**5. Laporan PDF**
Daftar aset per lokasi atau kelompok, dengan opsi **sembunyikan harga** dan opsi menyertakan log mutasi.

**6. Kategori & lokasi** (admin)
Tambah, ubah, atau nonaktifkan kategori, golongan penyusutan, lokasi, dan gudang atau mess di bawah site.

### Integrasi di layar lain

- **Logistik → Kendaraan & alat berat**: kolom nomor register dan tautan ke detail aset.
- **Master data → Karyawan → detail**: bagian **Aset yang dipakai** (baca saja), sebagai persiapan pengecekan
  saat karyawan keluar di fase 2.

## Migrasi data

1. Isi 5 kategori, golongan penyusutan dan 15 lokasi dari daftar isian register lama.
2. **Import register lama** (lihat layar Import). Aset ditandai `DATA_AWAL`, lalu `DocumentSequence` per kategori
   di-set ke nomor tertinggi hasil import.
3. **Cocokkan kendaraan:** sistem mengusulkan pasangan antara `Vehicle` dan register VEH (55 unit) berdasarkan plat
   di kolom PLAT NO / SN / PN, atau berdasarkan nama. Admin mengonfirmasi satu per satu. Genset dan alat ber-BBM di
   sheet MPK dicocokkan dengan cara yang sama. Unit `Vehicle` yang tidak punya pasangan ditampilkan di daftar
   "belum terdaftar".

## Dampak ke fase berikutnya (dari jawaban kuesioner)

- **Fase 2: pinjam tools.** Tidak ada toolkeeper, jadi cukup log pinjam: nama peminjam, mandor, perusahaan (untuk
  subkon), tanggal pinjam, dan tanggal rencana kembali. Notifikasi keterlambatan dan BAST yang belum dikonfirmasi
  dikirim lewat **email perusahaan**.
- **Fase 2: keluar atau cuti.** Semua aset harus dikembalikan sebelum karyawan keluar. Laptop boleh dibawa cuti.
  Kendaraan harus ditinggal.
- **Fase 3: opname** setiap 6 bulan, terjadwal atau mendadak. Barang yang tidak ditemukan dalam 1 minggu dibuatkan
  berita acara hilang.
- **Fase 3: penghapusan.** Alasannya rusak, hilang, atau hibah. Surat penghapusan ditandatangani bagian aset,
  logistik dan keuangan. Data disimpan **5 tahun** setelah dihapus.
- **Fase 3: perbaikan.** Persetujuan oleh PJO atau Direktur, tanpa batas nilai. Vendor dan biaya dicatat.
- **Fase 4: jurnal penyusutan.** Tidak ada batas kapitalisasi. Rumus nilai buku sudah ada di fase 1. Fase 4 hanya
  menambah jurnal tahunan ke Capex (bukan per proyek).

## Pertanyaan terbuka

| No | Hal | Kenapa terbuka |
|---|---|---|
| 1 | **Perbaikan register lama**: 4 baris MPK dengan rentang yang salah (2 di antaranya menimpa nomor baris lain), 1 nomor HSE yang dipakai dua kali, dan 1 kode OF tanpa tahun | Harus dibetulkan admin aset di Excel atau di layar import sebelum baris itu bisa masuk |
| 2 | **Tarif yang tidak sesuai golongan** (29 baris, termasuk bangunan Gol 4 dengan 12,5 %) | Perlu keputusan keuangan: tarif mana yang benar, golongan atau tarif per baris |
| 3 | **Barang sewaan** dicatat atau tidak | A5 menjawab tidak dicatat, tapi G1–G2 ingin kendaraan dan alat berat sewa dicatat sesuai kontrak. Rancangan ini menyediakan `ownership = SEWA` tanpa penyusutan |
| 4 | **Ganti rugi** karyawan atas aset hilang atau rusak | D6 menjawab belum ada aturan dan tidak ada PKB, tapi N4 menjawab potong gaji atau pesangon. Tidak mempengaruhi fase 1, tapi menentukan fase 2 |
| 5 | **Akun logistik site** | Perlu peran baru (misalnya `LOGISTIK_SITE` yang terikat ke satu site seperti `FUELMAN`), atau memakai akun yang sudah ada? |
| 6 | **Persetujuan site** dilakukan siapa | Jawaban E2: "harus disetujui oleh semua site". Apakah yang menyetujui logistik site, PJO, atau keduanya? |
| 7 | **Lokasi tambahan** (Tabang, Puruk Cahu, MAV, KM 13, Aceh) | Ada di data tetapi tidak disebut di kuesioner. Perlu dipastikan masih aktif, dan site E-HSE mana padanannya |
