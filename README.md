# ERP Prohaba Jaya Mandiri

Aplikasi Next.js 16, Auth.js, Prisma 7 dan Supabase PostgreSQL. Gunakan Node.js 22.

## Menjalankan pengembangan

File .env hanya berisi DATABASE_URL runtime development, AUTH_SECRET development dan AUTH_URL lokal. Token administrasi berada di .env.management.local. Jangan menyalin kredensial produksi ke .env.

    npm ci
    npm run db:check
    npm run dev

Database development memakai schema prohaba_dev dan role prohaba_runtime_dev. Produksi memakai schema public dan role prohaba_runtime. Keduanya bukan pemilik tabel, tidak dapat mengubah struktur, tidak dapat mengubah/menghapus AuditLog, dan harus melewati RLS. Otorisasi pengguna tetap diperiksa aplikasi pada setiap permintaan. Aplikasi tidak memakai Supabase Auth.

Koneksi memakai TLS dengan verifikasi sertifikat penuh. CA publik Supabase tersedia di prisma/certs/supabase-ca.crt dan dibundel untuk runtime. Kredensial tidak boleh memakai awalan NEXT_PUBLIC_.

## Migrasi dan akun admin

Kredensial migrasi prohaba_migrate_dev/prohaba_migrate hanya disimpan di .env.migrations.development.local dan .env.migrations.production.local. Akun ini mewarisi hak pemilik tabel untuk migrasi; login langsung pemilik lama sudah dinonaktifkan. Kedua file tidak dimuat otomatis oleh Next.js.

    npm run db:migrate
    npm run seed

Seeder hanya membuat admin development bila belum ada, dengan identitas Direktur Utama/admin@prohaba.co.id dan password acak di .env.admin.development.local. Seeder tidak menghapus data dan menolak produksi. Endpoint seed HTTP tetap nonaktif.

Setelah migrasi menambah tabel, terapkan hak runtime dan RLS sebelum rilis:

    node --env-file=.env.management.local --env-file=.env.migrations.development.local scripts/setup-runtime.mjs development

Migrasi produksi harus dijalankan dengan file migrasi produksi, setelah backup, pengujian development dan build berhasil. Jangan memakai db push untuk database aktif.

## Pemeriksaan sebelum rilis

    npm run verify
    npm audit

Untuk pengujian HTTP lengkap, jalankan server di port 3105 dengan .env runtime development, lalu jalankan:

    node --env-file=.env --env-file=.env.migrations.development.local scripts/integration.mjs http://localhost:3105

Skrip integrasi menolak schema selain prohaba_dev. Skrip membuat data sementara untuk tujuh peran, menguji transaksi melalui akun runtime server, dan memakai akun migrasi hanya untuk fixture serta pembersihan. Jalankan pada database development yang tidak sedang dipakai pengujian lain.

Workflow .github/workflows/ci.yml menjalankan instalasi bersih, audit dependensi, lint, uji unit dan build pada Node 22. Pengujian integrasi Supabase dilakukan terpisah; CI tidak diberi kredensial database atau produksi.

## Deployment Vercel

Proyek Vercel: prohaba-center. Domain: https://prohaba-center.vercel.app.

Production memerlukan DATABASE_URL runtime produksi, AUTH_SECRET produksi, dan AUTH_URL domain resmi. Development/preview memakai DATABASE_URL runtime development serta secret development yang berbeda. DIRECT_URL, SUPABASE_TOKEN, VERCEL_TOKEN, kredensial admin dan kunci backup tidak diperlukan runtime Vercel.

Build menggunakan npm run verify. Perubahan source yang belum memiliki pemeriksaan ini harus gagal build agar tidak menimpa rilis yang sudah diperbaiki. Environment baru berlaku pada deployment baru.

Source yang ada di workspace perlu disinkronkan ke GitHub agar CI dan auto-deploy memakai versi yang sama. Jangan mengirim .env*, .vercel, backup, node_modules atau .next ke repository.

## Backup dan pemulihan

    node --env-file=.env.migrations.production.local scripts/backup.mjs
    node --env-file=.env.management.local scripts/restore-drill.mjs public

Backup terenkripsi AES-256-GCM disimpan di .vercel/backups. Kunci lokal berada di .env.backup.local. Simpan salinan terenkripsi dan kuncinya pada lokasi cadangan terpisah yang aman. Tanpa kunci, backup tidak dapat dipulihkan.

Restore drill memakai schema sementara, memeriksa jumlah dan isi baris, kemudian menghapus schema sementara. Struktur sumber harus sesuai versi saat backup dibuat. Pemulihan bencana harus menyiapkan struktur dari versi migrasi backup terlebih dahulu; jangan langsung menimpa database aktif. Backup lokal belum merupakan jadwal backup otomatis di luar mesin ini.

## Master Data Karyawan (terintegrasi E-HSE)

Data karyawan disatukan dengan Database Personel E-HSE: E-HSE adalah sumber data, ERP memakai form yang sama dan menyimpan salinan lokal untuk penugasan, absensi dan payroll. Perlu `HSE_API_URL` dan `HSE_INTEGRATION_SECRET` (sama dengan `INTEGRATION_CENTER_SECRET` di E-HSE). Untuk development jalankan E-HSE di port 3001. Rincian, keamanan dan cara menautkan pegawai lama: docs/integrasi-master-karyawan.md.

## BBM drum site

Pencatatan BBM drum dari HO ke site: petugas BBM mencatat terima kiriman, pengambilan (scan kartu QR absensi pengambil), opname dan pengajuan drum lewat web HP `/bbm` yang bisa offline; Logistik HO memantau stok, kiriman, pengajuan dan anomali di menu Logistik & Kendaraan. Rincian dan aturan: docs/bbm-drum-site.md.

## Penggunaan setelah perbaikan

Finance menyiapkan mapping akun dan saldo awal melalui Master Data. HRD mengisi karyawan (Master Data → Karyawan, bersumber dari E-HSE). Proyek ditautkan ke site E-HSE; penugasan mengikuti penempatan site di E-HSE dan HRD melengkapi tarifnya sebelum payroll (docs/integrasi-master-karyawan.md). Persetujuan dan pembayaran terpisah. Semua proyek terlihat sesuai izin modul; tidak ada isolasi anggota proyek.

Rincian perubahan, bukti pengujian, batas kapasitas, dan kebijakan pencatatan ada di docs/remediation-2026-10-15.md. Payroll belum menghitung BPJS/PPh/potongan otomatis. Log BBM/perawatan baru masuk buku besar setelah dibuat faktur pembelian yang sesuai. Pembayaran pada aplikasi adalah pencatatan, bukan transfer bank.
