# Gudang HO — Rancangan Lokasi & Keluar-Masuk Barang

> Status: **rev. 2 (30-10-2026). Tahap 1 sedang dibangun** (master, lokasi, import saldo awal, label QR,
> transaksi dari desktop, surat jalan, laporan mingguan). Sumber data: laporan opname
> `Stok Gudang Kantor.xlsx` (sheet *30-Sept-2026*) dan foto gudang 30-10-2026. Operator: Logistik. Asumsi yang belum dikonfirmasi ditandai di
> [Pertanyaan terbuka](#pertanyaan-terbuka).

Modul ini mencatat **persediaan material** di gudang kantor (HO): fitting pipa, sanitair, electrical, bahan kimia,
dan material proyek sisa. Barang ini **habis pakai** dan dihitung per jumlah, sehingga terpisah dari modul
Inventaris Aset (`docs/inventaris-aset.md`), yang mencatat barang per unit bernomor register.

## Kondisi saat ini (opname 30-09-2026)

| Hal | Temuan |
|---|---|
| Isi | 283 jenis barang dalam 6 kelompok (Sanitair 13, Fitting PPR 43, Fitting PVC 55, Pintu & jendela 13, Electrical 39, Plumbing & hydrant 120), nilai **Rp 742.489.507** |
| Format | Mingguan: stok minggu lalu + masuk minggu ini − mutasi = stok akhir; nilai = stok × harga satuan |
| Kode barang | Belum ada. Identitas hanya nama, dan 5 nama muncul dua kali (mis. *Gate Valve 3" ex. Kitz*) |
| Satuan | Tidak seragam: `bh`/`Bh`, `unit`/`Unit `, `klg`/`Klg`, `m'`, `Roll`, `Psg`, `Lbr`, `Btg`, `ltr` |
| Riwayat | Tujuan mutasi ditulis di Keterangan (*"Mutasi Project MESS GL Tabang (13/6/26)"*). Angka mingguan ditimpa, sehingga pergerakan lama hilang |
| Lokasi | Tidak dicatat posisi barang di gudang |
| Data belum lengkap | 34 barang stok 0, 20 barang tanpa harga |

### Kondisi fisik (foto 30-10-2026)

| Hal | Temuan | Dampak ke rancangan |
|---|---|---|
| Rak | Rak besi *boltless* menempel di satu dinding, terlihat 2 bay lebar (± 2 m) dengan 4 tingkat + atas rak | Lokasi cukup **bay + tingkat**, bukan bin per titik |
| Barang kecil | Fitting PVC/PPR, kran, valve ditumpuk lepas di papan rak, tercampur | Perlu **kotak plastik (bin) berlabel** untuk barang kecil; bin menjadi lokasi |
| Lantai | Kardus sepatu safety VPRO, Sikaflex/SikaBond, valve besi di lantai depan dan bawah rak | Perlu **zona lantai** bernomor; bahan kimia dipisah |
| Campuran barang | Helm, sepatu safety (APD), aki Yuasa, kipas ventilasi, kardus printer ikut disimpan | Gudang HO juga menyimpan **APD dan barang umum**, bukan hanya material proyek |
| Penanda | Tidak ada label rak maupun label barang; kardus tanpa keterangan isi | Label tepi rak + label bin/kardus |
| Lorong | Kursi dan kardus di jalur depan rak | Rapikan dulu sebelum label dipasang |

## Prinsip

0. **Rapikan fisik dulu, baru digital.** Sistem hanya seakurat isi raknya. Satu kali penataan (5R/5S) sebelum
   label dipasang: buang yang rusak, kelompokkan per jenis, barang kecil masuk bin, lorong dikosongkan.
1. **Kartu stok, bukan saldo.** Setiap pergerakan menjadi satu baris transaksi yang tidak bisa diedit. Stok dan nilai
   dihitung dari transaksi. Salah input dikoreksi dengan transaksi balik beserta alasan (pola sama dengan BBM).
2. **Label di lokasi dan jenis barang, bukan per buah.** Rak/bin diberi label lokasi, setiap jenis barang diberi label
   SKU (ditempel di depan bin atau di kardus). Barang mahal yang dipakai satuan boleh dilabel per kardus.
3. **Setiap barang keluar punya tujuan.** Proyek atau site tujuan wajib diisi, sehingga nilai material bisa dibebankan
   ke proyek dan laporan "material ke proyek X" bisa ditarik.
4. **Scan memakai kamera HP.** Web HP seperti `/bbm`, tetapi **tanpa mode offline** karena gudang HO punya sinyal
   dan hanya dioperasikan satu bagian (Logistik). Pemindai USB di meja admin juga bisa dipakai karena bekerja
   seperti keyboard.
5. **Laporan mingguan tetap tersedia** dengan format yang sama seperti Excel sekarang, dibuat otomatis dari kartu stok.

## Kode

| Jenis | Format | Contoh | Keterangan |
|---|---|---|---|
| Barang (SKU) | `MTR-<kelompok>-<nomor>` | `MTR-ELC-0012` | Nomor urut per kelompok, permanen. Kelompok di bawah |
| Lokasi rak | `HO-<bay>-<tingkat>` | `HO-R1-T3` | Bay rak dinomori kiri→kanan (`R1`, `R2`, …), tingkat dari bawah (`T1` papan terbawah … `T5` atas rak) |
| Lokasi bin | `HO-<bay>-<tingkat>-<bin>` | `HO-R1-T3-B04` | Hanya untuk kotak plastik barang kecil di tingkat itu, dinomori kiri→kanan |
| Zona lantai | `HO-LT-<nomor>` | `HO-LT-02` | Area lantai bertanda (cat/lakban), mis. LT-01 bahan kimia, LT-02 kardus APD, LT-03 material panjang/berat |

Kelompok barang:

| Kode | Kelompok | Sumber |
|---|---|---|
| SAN | Sanitair | Opname September |
| PPR | Fitting pipa PPR | Opname September |
| PVC | Fitting pipa PVC | Opname September |
| PJD | Aksesoris pintu & jendela | Opname September |
| ELC | Electrical | Opname September |
| PLB | Plumbing & hydrant | Opname September |
| KIM | Bahan kimia & cat (Sika, Propan, Penetran) | Dipisah dari PLB karena butuh zona sendiri |
| APD | Alat pelindung diri (helm, sepatu safety, sarung tangan) | Foto; APD di HO dikelola Logistik (kuesioner A4). Ukuran berbeda = SKU berbeda, mis. sepatu VPRO 40 dan 41 |
| UMM | Barang umum & suku cadang (aki, kipas, toner) | Foto. Barang yang sebenarnya aset (mis. printer baru) didaftarkan di register aset saat dipakai |

**Isi QR**: URL `/g/b/<SKU>` untuk barang dan `/g/l/<lokasi>` untuk lokasi, sehingga kamera HP biasa langsung
membuka halaman barang atau isi rak (wajib login).

**Penempatan label:**
- **Label lokasi** di tepi depan papan rak (satu per bay per tingkat), di bin, dan di lantai/dinding untuk zona lantai.
- **Label barang** di sisi depan bin, atau di sisi kardus yang menghadap lorong untuk barang dalam kardus.
- Ukuran 50 × 30 mm, dicetak dari sistem di kertas stiker A4 (printer kantor) atau printer label. Untuk tepi rak
  besi, pakai stiker vinyl atau tempat label magnet agar mudah dipindah.

**Aturan penataan (penyesuaian dari foto):**
- Barang **berat** (valve besi, aki, sanitair) di T1–T2; barang **sering keluar** (fitting kecil, lampu) setinggi
  pinggang–dada (T2–T3); barang **jarang keluar dan ringan** di T4–atas rak.
- Satu bin = satu SKU. Satu SKU boleh di lebih dari satu lokasi, tetapi punya satu lokasi utama.
- Bahan kimia (Sika, cat, remover) di zona lantai sendiri, tidak di atas barang lain.
- Lorong depan rak bebas barang; kardus lantai hanya di zona bertanda.

## Tabel

### `StockItem` — master barang

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | String (cuid) | |
| `sku` | String unik | `MTR-ELC-0012` |
| `groupCode` | → `StockGroup` | Kelompok (SAN, PPR, …) |
| `name` | String | Nama baku setelah dirapikan |
| `spec` | String? | Merek, ukuran, tipe |
| `unit` | String | Satuan baku: `bh`, `unit`, `set`, `psg`, `m`, `roll`, `lbr`, `btg`, `klg`, `ltr`, `gln` |
| `decimals` | Boolean | `true` untuk satuan yang bisa dipotong (`m`, `ltr`), sehingga jumlah boleh desimal |
| `minStock` | Decimal? | Batas peringatan stok minimum |
| `homeLocationId` | String? → `StockLocation` | Lokasi utama barang |
| `isActive` | Boolean | Barang yang tidak dipakai lagi dinonaktifkan, tidak dihapus |
| `createdAt`, `updatedAt` | DateTime | |

### `StockGroup`

| Field | Tipe | Keterangan |
|---|---|---|
| `code` | String @id | `SAN`, `PPR`, `PVC`, `PJD`, `ELC`, `PLB` |
| `name` | String | |

### `StockLocation` — rak/bin

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | String (cuid) | |
| `code` | String unik | `HO-R1-T3`, `HO-R1-T3-B04`, `HO-LT-02` |
| `type` | String | `RAK` \| `BIN` \| `LANTAI` |
| `parentId` | String? → `StockLocation` | Bin berada di tingkat rak tertentu |
| `warehouse` | String | `HO` (gudang site bisa ditambahkan nanti) |
| `description` | String? | Mis. "Rak besi depan pintu" |
| `isActive` | Boolean | |

### `StockMovement` — kartu stok (inti)

Satu baris per barang per lokasi per transaksi. Saldo = jumlah `qty` (masuk positif, keluar negatif).

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | String (cuid) | |
| `documentId` | → `StockDocument` | Dokumen asal |
| `itemId` | → `StockItem` | |
| `locationId` | → `StockLocation` | |
| `qty` | Decimal(14,3) | + masuk, − keluar |
| `unitCost` | Decimal(20,2) | Harga satuan pada saat transaksi (rata-rata bergerak untuk barang keluar) |
| `createdAt` | DateTime | |

Indeks: `[itemId, locationId]`, `[documentId]`.

### `StockDocument` — dokumen transaksi

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | String (cuid) | |
| `number` | String unik | `GM-2026-000001` (masuk), `GK-…` (keluar), `GP-…` (pindah rak), `GO-…` (opname), memakai `nextNumber` |
| `type` | String | `SALDO_AWAL` \| `MASUK` \| `KELUAR` \| `RETUR` \| `PINDAH` \| `OPNAME` \| `KOREKSI` |
| `projectId` | String? → `Project` | Wajib untuk `KELUAR` dan `RETUR` |
| `destination` | String? | Tujuan lain yang bukan proyek (mis. Workshop, Mess HO) |
| `poId` | String? → `PurchaseOrder` | Asal barang masuk dari PO |
| `materialRequestId` | String? → `MaterialRequest` | Permintaan site yang dipenuhi |
| `takerEmployeeId` | String? → `Employee` | Pengambil barang (scan kartu QR absensi) |
| `takerName` | String? | Pengambil tanpa kartu |
| `vehicleNo`, `driverName` | String? | Untuk surat jalan |
| `reason` | String? | Wajib untuk `KOREKSI` dan selisih `OPNAME` |
| `status` | String | `DRAFT` \| `SELESAI` \| `DIBATALKAN` |
| `approvedById` | String? → `User` | Persetujuan selisih opname dan koreksi |
| `createdById` | → `User` | |
| `clientId` | String? unik | Id dari HP untuk antrean offline (pengiriman ulang tidak tercatat dua kali) |
| `createdAt` | DateTime | Tanggal transaksi |

### `StockCount` + `StockCountLine` — opname

| Field | Tipe | Keterangan |
|---|---|---|
| `StockCount.id`, `number` | String | `GO-2026-000001` |
| `StockCount.scope` | String | `SEMUA` \| `RAK` \| `KELOMPOK` \| `NILAI_TINGGI` |
| `StockCount.status` | String | `BERJALAN` \| `MENUNGGU_PERSETUJUAN` \| `SELESAI` |
| `StockCountLine.itemId`, `locationId` | → | |
| `StockCountLine.systemQty` | Decimal | Disimpan saat opname dimulai, **tidak ditampilkan** ke penghitung |
| `StockCountLine.countedQty` | Decimal? | Hasil hitung |

Setelah disetujui, selisih menjadi satu `StockDocument` tipe `OPNAME`.

## Alur

```
MASUK:  pilih asal (PO / retur / lainnya) → scan barang → jumlah → harga (otomatis dari PO) → scan lokasi tujuan → simpan
KELUAR: pilih proyek tujuan (+ MR bila ada) → scan lokasi → scan barang → jumlah → ulangi → scan kartu pengambil
        → simpan → surat jalan PDF (nomor GK, daftar SKU, jumlah, tujuan, pengambil, sopir)
PINDAH: scan lokasi asal → scan barang → jumlah → scan lokasi tujuan
CEK:    scan lokasi → isi lokasi dan jumlahnya | scan barang → stok per lokasi, 10 transaksi terakhir
OPNAME: pilih cakupan → hitung per lokasi (scan lokasi → scan barang → isi jumlah) → admin lihat selisih
        → disetujui atasan → penyesuaian masuk kartu stok
```

Aturan:
- Barang keluar tidak boleh membuat stok di rak itu minus.
- Barang keluar tanpa proyek hanya boleh dengan tujuan lain yang diisi (Workshop, Mess, dan sebagainya).
- Transaksi yang sudah `SELESAI` tidak bisa diedit. Pembatalan membuat dokumen `KOREKSI` dengan alasan, dan
  tercatat di `AuditLog` (`module = "STOCK"`).
- Opname: barang bernilai tinggi (nilai stok ≥ batas tertentu, mis. Geogrid, Pagar BRC) dihitung bulanan,
  sisanya per kuartal, dan seluruh gudang setahun sekali.

## Nilai stok

- **Rata-rata bergerak**: setiap barang masuk mengubah harga rata-rata; barang keluar dinilai dengan harga rata-rata
  saat itu.
- Saldo awal memakai harga satuan dari opname 30-09-2026. Barang tanpa harga (20) masuk dengan harga 0 dan ditandai
  sampai dilengkapi.

### Kontrol karena operatornya satu bagian

Logistik yang menerima, menyimpan, mengeluarkan dan mencatat barang. Supaya tetap terkendali tanpa menambah orang:
- **Pengambil ikut tercatat**: setiap barang keluar wajib scan kartu QR absensi pengambil (atau nama lengkap bila
  tanpa kartu), dan namanya tercetak di surat jalan.
- **Logistik tidak bisa menyetujui selisihnya sendiri**: selisih opname dan koreksi transaksi disetujui Top Management.
- **Opname sesekali oleh orang lain**: minimal setahun sekali (atau mendadak) dihitung oleh orang di luar Logistik,
  mis. admin aset atau Finance, dengan *blind count*.
- **Laporan pengecualian** untuk Top Management: koreksi, selisih opname, barang keluar tanpa MR, dan barang bernilai
  tinggi yang keluar dalam minggu itu.

## Integrasi dengan modul lain

| Modul | Integrasi |
|---|---|
| Material Request | Saat MR dibuat, tampil stok gudang HO untuk barang yang mirip. MR bisa dipenuhi dari gudang (dokumen `KELUAR` terhubung ke MR) sebelum dibuat PO |
| Procurement / PO | Penerimaan barang PO untuk gudang HO langsung membuat dokumen `MASUK` dengan harga dari PO |
| Biaya proyek | Nilai barang `KELUAR` dikurangi `RETUR` per proyek muncul sebagai biaya material proyek (laporan dulu; hubungan ke BOQ menyusul) |
| Inventaris Aset | Terpisah. Barang yang ternyata aset (mis. genset) didaftarkan di register aset, bukan di gudang |

## Layar

**Menu Gudang HO** (`/gudang`, desktop) — tab:
1. **Stok** — daftar barang per kelompok: stok, satuan, lokasi, nilai; filter stok minimum dan *dead stock*
   (tanpa pergerakan 6 bulan).
2. **Transaksi** — daftar dokumen (masuk, keluar, pindah, koreksi) dengan filter proyek dan tanggal; detail dan
   cetak surat jalan.
3. **Laporan** — laporan mingguan format Excel lama, rekap material per proyek, nilai stok per kelompok.
4. **Opname** — buat opname, lihat selisih, setujui.
5. **Master** — barang, kelompok, lokasi, cetak label QR.

**Web HP** (`/gudang/scan`): tombol besar **Masuk**, **Keluar**, **Pindah rak**, **Cek**, **Opname**, mengikuti
tampilan `/bbm`, tanpa mode offline.

## Hak akses (usulan)

| Peran | Akses |
|---|---|
| Logistik (operator gudang HO) | Transaksi masuk, keluar, pindah; master barang dan lokasi; cetak label; menghitung opname |
| `TOP_MANAGEMENT` | Semua, termasuk **menyetujui selisih opname dan koreksi** |
| `FINANCE` | Lihat stok, nilai, dan laporan |
| `PJO` | Lihat stok gudang HO dan barang yang dikirim ke proyeknya |

## Migrasi

1. **Rapikan data** (di layar pratinjau import, atau di Excel sebelum import):
   - seragamkan satuan (`Bh` → `bh`, `Unit ` → `unit`, `m'` → `m`, dan seterusnya),
   - gabungkan 5 nama yang dobel, atau tandai sebagai barang berbeda bila memang berbeda,
   - tentukan 34 barang stok 0: tetap aktif atau dinonaktifkan,
   - lengkapi harga 20 barang.
2. **Import** sheet opname menjadi master barang + satu dokumen `SALDO_AWAL` per 30-09-2026. SKU dibuat sistem
   per kelompok. Pergerakan Oktober yang sudah terjadi dicatat menyusul sebagai transaksi biasa.
3. **Penataan fisik (1–2 hari kerja)**: kosongkan lorong, beri nomor bay dan tingkat, tandai zona lantai, masukkan
   barang kecil ke bin, pisahkan APD dan bahan kimia ke tempatnya.
4. **Labeling**: cetak label lokasi dan barang, tempel, lalu tetapkan lokasi utama tiap barang lewat scan
   (scan lokasi → scan barang). Langkah ini sekaligus menjadi pengecekan fisik awal.
5. **Barang di luar opname September** (APD, aki, kipas, dan lainnya yang terlihat di foto) didaftarkan sebagai barang
   baru dengan saldo awal hasil hitung saat penataan.

## Tahapan

| Tahap | Isi |
|---|---|
| 1 | Master barang, lokasi, import saldo awal, label QR, transaksi masuk/keluar/pindah dari desktop, surat jalan, laporan mingguan |

Catatan tahap 1: opname (`StockCount`) belum dibuat; pengambil dicatat dengan nama (scan kartu di tahap 2);
barang hasil import masuk lokasi `HO-PENAMPUNG` lalu dipindah ke rak lewat transaksi **Pindah lokasi**;
pembatalan dokumen hanya oleh Top Management dan harga rata-rata dihitung ulang dari kartu stok.
| 2 | Web HP dengan scan (online), scan kartu pengambil |
| 3 | Opname bergilir dengan *blind count* dan persetujuan selisih |
| 4 | Integrasi Material Request dan penerimaan PO, rekap biaya material per proyek |

## Pertanyaan terbuka

| No | Hal | Asumsi di rancangan ini |
|---|---|---|
| 1 | ~~Operator gudang HO~~ | **Terjawab: Logistik** (30-10-2026) |
| 2 | Jumlah bay rak di gudang (foto hanya menunjukkan satu dinding, 2 bay) dan apakah ada ruang/rak lain | Penomoran `R1…Rn` kiri→kanan mulai dari pintu |
| 3 | Barang keluar ke proyek dibebankan sebagai biaya proyek? | Ya, sebagai laporan dulu |
| 4 | Barang yang dipotong (pipa per meter, kabel per roll) | Jumlah boleh desimal untuk satuan `m`/`ltr`; roll tetap dihitung per roll |
| 5 | Cakupan: hanya gudang HO, atau gudang site juga? | Dirancang bisa banyak gudang, dibangun untuk HO dulu |
| 6 | APD di gudang HO: dicatat di sini, atau sudah di E-HSE? | Dicatat di sini sebagai stok (kelompok APD); pembagian ke karyawan tetap urusan HSE |
| 7 | Anggaran kotak plastik (bin) dan stiker label | Bin hanya untuk barang kecil; jumlah ditentukan saat penataan |
| 8 | Batas "nilai tinggi" untuk opname bulanan | Ditentukan setelah data masuk (mis. 20 % barang dengan nilai stok terbesar) |
| 9 | Siapa di luar Logistik yang bisa melakukan opname tahunan/mendadak | Admin aset atau Finance |
