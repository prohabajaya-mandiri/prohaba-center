-- NIP karyawan disalin dari E-HSE (Personnel.nip). Nullable: terisi saat HRD melengkapi NIP di E-HSE.
ALTER TABLE "Employee" ADD COLUMN "nip" TEXT;
