# ERP Prohaba Jaya Mandiri

Next.js 16.4.1, NextAuth, Prisma 7, dan Supabase PostgreSQL.

## Menjalankan lokal

Gunakan Node.js 22 atau lebih baru. Salin `.env.example` ke `.env` hanya jika belum memiliki `.env`, lalu isi kredensial aplikasi.

```sh
npm ci
npm run db:migrate
npm run db:check
npm run dev
```

`DATABASE_URL` menggunakan Supabase transaction pooler (port 6543). `DIRECT_URL` menggunakan session pooler (port 5432) untuk migrasi. Keduanya memakai role `prohaba_app`, TLS dengan verifikasi sertifikat penuh, dan CA publik di `prisma/certs/supabase-ca.crt`. Prisma CLI membaca path sertifikat relatif terhadap root proyek. Runtime memakai salinan CA publik yang dibundel pada src/lib/supabase-ca.js agar semua fungsi Vercel dapat memverifikasi TLS tanpa bergantung pada lokasi file.

CA berasal dari URL resmi yang digunakan dashboard Supabase:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Prisma CLI memuat `.env` melalui `prisma.config.ts`. Next.js memuatnya otomatis. Jangan menambahkan awalan `NEXT_PUBLIC_` pada kredensial database atau token. Token pengelolaan `SUPABASE_TOKEN` dan `VERCEL_TOKEN` hanya untuk administrasi; keduanya tidak dibutuhkan aplikasi dan tidak diunggah ke Vercel.

## Database dan deployment

Project Supabase: `prohaba-center` (`kdkoyvcdmwkrooywirzp`). Project Vercel: `prohaba-center`.

Environment production Vercel membutuhkan `DATABASE_URL`, `DIRECT_URL`, dan `AUTH_SECRET`. Development dan preview memakai schema prohaba_dev serta secret sesi terpisah dari production. Perubahan environment baru berlaku pada deployment berikutnya.

```sh
npm run db:migrate
npm run build
```

Migrasi awal membuat tabel ERP dan mengaktifkan RLS. Aplikasi mengakses tabel melalui role pemilik di server; tidak ada policy akses langsung untuk `anon` atau `authenticated` Supabase. Autentikasi tetap menggunakan NextAuth dan tabel `User`, bukan Supabase Auth.

Database baru tidak diisi data contoh atau akun dengan password bawaan. `npm run seed` adalah skrip demo lama yang **menghapus data**; jangan menjalankannya pada database aktif. Endpoint `/api/seed` dinonaktifkan (410). Siapkan akun admin dengan password kuat sebelum penggunaan aplikasi.

## Pengamanan deployment

- Semua API bisnis memeriksa sesi aktif, izin modul, dan origin permintaan perubahan. Perubahan role atau penonaktifan akun berlaku pada pemeriksaan sesi berikutnya.
- Persetujuan payroll memakai identitas login dan transisi status atomik; identitas pencatat tidak diambil dari request browser.
- Dokumen privat dibatasi 4 MB dan disimpan di tabel DocumentContent, lalu diunduh melalui API berizin. Untuk volume/besar file meningkat, pindahkan ke object storage privat.
- Development memakai role dan schema prohaba_dev yang terpisah dari production public. Kedua schema masih berbagi instance Supabase dan kapasitasnya.
- .env menyimpan konfigurasi development dan token administrasi; .env.production.local menyimpan konfigurasi production, .env.admin.local menyimpan kredensial admin production. Semua diabaikan Git dan upload deployment.
- Jalankan npm run dev untuk development. npm run build menggunakan environment production lokal; jangan memakai akun/data production untuk uji mutasi.
- Seeder demo hanya dapat berjalan pada prohaba_dev dengan ALLOW_DESTRUCTIVE_DEMO_SEED=true; perintah ini tetap menghapus data development.
- Jalankan npm test, npm run db:check, dan npm run build sebelum deploy.

Dependency runtime Next.js, Auth.js, dan SheetJS telah diperbarui. Audit masih melaporkan advisory pada dependency tooling Prisma/ESLint (deepmerge-ts, mysql2, braces); jangan menjalankan tooling pada konfigurasi atau pola glob yang tidak tepercaya. Pembaruan major paksa tidak dilakukan. Ini bukan hasil penetration test menyeluruh.

Admin development memiliki password terpisah di .env.admin.development.local. Jalankan uji HTTP dengan node --env-file=.env.admin.local scripts/smoke.mjs https://prohaba-center.vercel.app. Uji role dan file privat pada development: node --env-file=.env scripts/dev-security.mjs http://localhost:3000 (server development harus berjalan). Data uji dibersihkan setelah pemeriksaan.

Deployment production dilakukan langsung melalui Vercel API. Perubahan source masih lokal: commit dan push versi ini sebelum mengandalkan auto-deploy GitHub agar kode lama tidak menimpa pengamanan.

Verifikasi deployment terakhir: https://prohaba-center.vercel.app — login admin, dashboard, query database, penolakan API anonim, dan penolakan perubahan lintas-origin berhasil. Uji development juga memverifikasi pencabutan sesi akun nonaktif, larangan eskalasi role, serta siklus upload/unduh/hapus dokumen privat.
