# Laporan perbaikan audit Prohaba Center

Audit: 15 Oktober 2026. Penyelesaian rilis: 16 Oktober 2026 WITA. Lingkup: 20 temuan audit, koneksi Supabase, keamanan pengembangan, dan deployment Vercel.

## Keputusan operasional

- Semua proyek dapat dilihat oleh pengguna yang memiliki izin modul terkait. Tidak diberlakukan pembatasan berdasarkan anggota proyek.
- Tarif payroll wajib diisi per penugasan proyek: harian atau alokasi bulanan, serta tarif lembur termasuk 0 bila tidak berlaku. Sistem menolak generate bila tarif belum lengkap.
- Penugasan bulanan harus meliputi satu periode penuh. Untuk periode parsial, gunakan tarif harian; sistem tidak menebak rumus prorata.
- Persetujuan payroll dan pencatatan pembayaran adalah tindakan terpisah. Pencatatan pembayaran tidak mengirim transfer bank.

## Penanganan setiap temuan

| No. | Temuan | Perbaikan | Bukti pemeriksaan |
|---|---|---|---|
| 1 | Workshop menerima perubahan relasi bertingkat dan dapat menaikkan role | Semua payload memakai daftar field eksplisit. Perubahan relasi dari browser ditolak | Percobaan nested update menghasilkan 400; role tidak berubah |
| 2 | Password hash dan data pribadi pegawai terkirim ke browser | Password dihilangkan secara bawaan pada Prisma; hanya login memilih password secara eksplisit. Halaman HR operasional hanya mengambil nama/jabatan | Pemeriksaan payload bon dan HR PJO; pengujian akses tujuh peran |
| 3 | Generate dan persetujuan payroll tidak sesuai skema | Periode/tanggal benar, tarif penugasan eksplisit, absensi terikat proyek, approval memakai identitas login, pembayaran membuat jurnal | Generate nominal 130.000 dari tarif 100.000 dan 2 jam lembur @15.000; urutan approval; percobaan ulang pembayaran tidak menggandakan transaksi |
| 4 | Alur MR, PO, penerimaan, faktur pemasok dan pembayaran belum lengkap | Persetujuan PJO/direktur, PO mengambil item MR yang disetujui, penerimaan parsial, faktur AP dan pembayaran parsial/final | MR → PO → penerimaan → AP → lunas; penerimaan berlebih ditolak |
| 5 | Impor BOQ menghapus identitas dan riwayat | Impor mencocokkan kode, mempertahankan ID, jadwal dan realisasi; penghapusan item berhistori ditolak; seluruh impor dalam satu transaksi | Impor ulang mempertahankan ID/realisasi; impor pengganti yang merusak histori ditolak dan data awal tetap ada |
| 6 | Dashboard dan laba proyek menggunakan angka contoh | Dashboard mengambil data tercatat; saldo dihitung dari jurnal dan saldo awal; laba dari jurnal pendapatan/biaya; hutang memakai sisa setelah pembayaran | Halaman dengan data transaksi dirender; keseimbangan seluruh jurnal diperiksa |
| 7 | Alokasi DP, pembayaran dan jurnal tidak konsisten | DP harus lunas, satu proyek dan tarif pajak sama; saldo alokasi dikunci transaksi; uang muka belum menjadi pendapatan; pembayaran berreferensi unik; pembatalan membuat jurnal pembalik | DP lintas proyek/terpakai ditolak; alokasi kembali setelah pembatalan; penerimaan ulang idempoten; jurnal seimbang |
| 8 | Harga referensi dapat dipalsukan dari browser | Browser hanya mengirim ID referensi; harga dan satuan dibaca server; tanpa referensi selalu ditandai untuk review | Payload refPrice ditolak; bon tanpa referensi ditandai; alasan review dan kuitansi diperlukan |
| 9 | Validasi lemah dan PATCH menimpa field yang tidak dikirim | Validasi field, enum, angka terbatas, nominal dua desimal, tanggal, kepemilikan relasi dan rentang; PATCH proyek hanya mengubah field yang dikirim | Tanggal mustahil, nominal negatif, field asing dan relasi silang ditolak; kontrak tetap setelah PATCH nama |
| 10 | Kurva S menghitung subtotal ganda dan edit realisasi bercampur bulan | Hanya item detail dihitung; state per proyek/bulan/item; total realisasi maksimal 100%; endpoint lama dihentikan; kegagalan tidak tampil sebagai sukses | Uji unit kurva dan progres berlebih; simpan jadwal; histori realisasi; akses Finance hanya baca |
| 11 | Password reset tidak mencabut sesi dan login tidak dibatasi | Session version berubah saat reset/penonaktifan; role/status dibaca ulang; pembatasan login tersimpan berdasarkan akun dan IP | Sesi lama setelah reset menghasilkan 401; uji batas dan reset jendela login |
| 12 | Audit tidak lengkap atau terpisah dari transaksi | Perubahan bisnis dan audit disimpan pada transaksi yang sama; password/secret/token dibuang dari audit; runtime tidak dapat UPDATE/DELETE AuditLog | Pemeriksaan audit transaksi dan pengecekan hak database |
| 13 | Dokumen tidak konsisten dengan izin Workshop/proyek aktif | Halaman mengikuti izin modul dan menerima proyek ACTIVE/ON_HOLD; dokumen privat diunduh lewat pemeriksaan sesi | Workshop dapat membaca dokumen berizin; unduhan anonim ditolak; Workshop tidak dapat menghapus |
| 14 | Delete workshop salah ID dan status terkirim terlalu cepat | ID route benar, transisi berurutan, item harus selesai sebelum kirim, WO DELIVERED hanya setelah diterima di site | Siklus fabrikasi/potong/las/selesai/kirim/terima dan penghapusan WO rencana |
| 15 | Penomoran count+1 dan duplikasi transaksi | Counter atomik DocumentSequence; unique constraint pada payroll, absensi, realisasi, approval dan referensi pembayaran/penerimaan | Tiga WO bersamaan menghasilkan nomor berbeda; absensi dan pembayaran ulang tidak ganda |
| 16 | Runtime memakai akun pemilik dan kredensial pengembangan bercampur | Runtime non-pemilik dengan RLS; token administrasi dan URL migrasi disimpan terpisah; login pemilik lama dinonaktifkan setelah rilis baru terverifikasi; development/preview memakai skema dan secret sendiri | Pemeriksaan owner, bypass RLS, CREATE schema dan hak audit; verifikasi environment deployment |
| 17 | Query tidak dibatasi dan indeks belum memadai | Riwayat utama dipaginasi 50 baris, API maksimal 100; indeks foreign key/filter/jurnal; batas file/arsip/BOQ; impor/jadwal memakai operasi sekaligus | Uji paginasi/arsip dan impor ulang 1.000 BOQ beserta jadwal; ringkasan logistik diberi lingkup halaman yang jelas |
| 18 | Lint gagal dan pengujian/CI kurang | Lint dibersihkan; pengujian validasi, uang, sesi, parser dan kurva ditambah; pengujian HTTP lintas fitur; workflow CI | npm run verify: lint, 12 uji unit, build; pengujian integrasi terpisah |
| 19 | Dependensi memiliki advisory tinggi | deepmerge-ts dan mysql2 diperbarui melalui override; dependensi lint yang membawa braces tanpa patch diganti dengan pemeriksaan React/hooks | npm audit melaporkan 0 kerentanan pada instalasi yang diperiksa |
| 20 | Sidebar bergantung pada sesi browser yang terlambat | Sidebar memakai user yang telah diverifikasi server dan izin modul yang sama | Pengujian halaman/dashboard pada tujuh peran; login produksi |

## Penambahan dan perubahan data

Migrasi menambahkan tarif penugasan, proyek pada absensi, session version, referensi jurnal/pembayaran, bukti penerimaan PO, kuitansi privat, counter nomor dan pembatas login. Nominal uang disimpan sebagai Decimal(20,2). Data bisnis tidak diisi dengan data contoh. Proyek diarsipkan, bukan dihapus permanen.

Seeder lama yang menghapus data dan memakai password bawaan diganti dengan bootstrap admin development yang idempoten serta password acak lokal. Salinan komponen .bak dan skrip layout rusak dibuang.

## Operasional yang perlu diisi

1. Finance menyiapkan mapping akun melalui Master Data → Akun buku besar. Saldo awal harus sesuai data perusahaan dan tidak dapat diubah setelah akun dipakai jurnal.
2. HRD mengisi pegawai, penugasan, tarif harian/bulanan, dan lembur. Absensi yang sudah masuk payroll dikunci.
3. Logistik/Finance mengisi pemasok dan referensi harga. Persetujuan bon memerlukan bukti dan akun kas/bank.

## Batas pemeriksaan dan kebijakan pencatatan

- Hasil ini menutup temuan yang diaudit dan diuji; bukan jaminan aplikasi bebas dari seluruh kemungkinan kerentanan.
- Payroll menghitung tarif dan kehadiran. Tunjangan, potongan, BPJS dan PPh belum dihitung otomatis. Angka tersebut tidak boleh dianggap hasil perhitungan kepatuhan pajak/ketenagakerjaan.
- Biaya payroll dan bon site dicatat saat pembayaran/persetujuan pengeluaran. Catatan BBM/perawatan merupakan log operasional; buat faktur pembelian yang sesuai agar masuk buku besar. Hindari mencatat kuitansi yang sama melalui bon dan AP.
- Laporan mencerminkan jurnal yang dicatat. Saldo rekening riil dan dokumen pemasok tetap perlu direkonsiliasi oleh Finance.
- File privat maksimum 4 MB disimpan di database. Riwayat memakai paginasi; pilihan master dibatasi hingga 1.000 entri dan akun hingga 500. Untuk skala lebih besar diperlukan pencarian master di server dan penyimpanan file privat terpisah.
- Development dan produksi menggunakan skema/role berbeda pada satu instance Supabase. Kapasitas, pemeliharaan dan cadangan instance masih berbagi.
- Workflow CI disiapkan untuk menjalankan pemeriksaan pada push/pull request tanpa kredensial produksi. Source dan hasil pemeriksaan rilis disimpan pada branch perbaikan untuk ditinjau.

## Bukti lokal

Output pengujian, manifest backup terenkripsi, uji pemulihan dan identitas deployment disimpan di direktori .vercel yang tidak masuk Git. Kunci backup berada di .env.backup.local. Nilai rahasia tidak dicantumkan dalam laporan ini.

## Hasil rilis

Rilis produksi aktif pada https://prohaba-center.vercel.app, deployment dpl_ScE2veXrAGAM1bsVNJeaZLEb3DBS. Login, sidebar dan 16 halaman utama diverifikasi melalui pemeriksaan baca. Database produksi memiliki 42 tabel dengan RLS, runtime bukan pemilik tabel, dan empat migrasi sudah diterapkan.

Source tersedia pada draft PR https://github.com/prohabajaya-mandiri/prohaba-center/pull/1. Main belum digabungkan. CI GitHub dan deployment preview berhasil; hasil akhir per commit dapat dilihat pada PR.
