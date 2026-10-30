BEGIN;
-- Rekening opsional: tanda "no rekening terisi" dari umpan E-HSE (tanpa nomornya) untuk peringatan payroll. Aditif;
-- null = belum diterima, diisi oleh pengisian awal sinkronisasi karyawan.
-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "hasBankAccount" BOOLEAN;
COMMIT;
