BEGIN;
-- Inventaris aset fase 1: kategori, golongan penyusutan, lokasi, register aset. Aditif; belum ada data aset.

-- CreateTable
CREATE TABLE "AssetCategory" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seqWidth" INTEGER NOT NULL DEFAULT 4,
    "defaultDepreciationClass" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "DepreciationClass" (
    "code" TEXT NOT NULL,
    "rate" DECIMAL(6,4) NOT NULL,

    CONSTRAINT "DepreciationClass_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "AssetLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentId" TEXT,
    "hseSiteId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AssetLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "registerNo" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandSpec" TEXT,
    "identifier" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unitPrice" DECIMAL(20,2),
    "depreciationClass" TEXT,
    "depreciationRate" DECIMAL(6,4),
    "acquiredAt" TIMESTAMP(3),
    "costEstimated" BOOLEAN NOT NULL DEFAULT false,
    "acquisitionSource" TEXT NOT NULL,
    "ownership" TEXT NOT NULL DEFAULT 'MILIK',
    "ownerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AKTIF',
    "condition" TEXT NOT NULL,
    "damagedYear" INTEGER,
    "locationId" TEXT NOT NULL,
    "area" TEXT,
    "endUserEmployeeId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetLocation_code_key" ON "AssetLocation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AssetLocation_name_key" ON "AssetLocation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_registerNo_key" ON "Asset"("registerNo");

-- CreateIndex
CREATE INDEX "Asset_batchId_idx" ON "Asset"("batchId");

-- CreateIndex
CREATE INDEX "Asset_categoryCode_registerNo_idx" ON "Asset"("categoryCode", "registerNo");

-- CreateIndex
CREATE INDEX "Asset_locationId_status_idx" ON "Asset"("locationId", "status");

-- CreateIndex
CREATE INDEX "Asset_endUserEmployeeId_idx" ON "Asset"("endUserEmployeeId");

-- CreateIndex
CREATE INDEX "Asset_identifier_idx" ON "Asset"("identifier");

-- AddForeignKey
ALTER TABLE "AssetLocation" ADD CONSTRAINT "AssetLocation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AssetLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryCode_fkey" FOREIGN KEY ("categoryCode") REFERENCES "AssetCategory"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_depreciationClass_fkey" FOREIGN KEY ("depreciationClass") REFERENCES "DepreciationClass"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "AssetLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_endUserEmployeeId_fkey" FOREIGN KEY ("endUserEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssetLocation" ADD CONSTRAINT "asset_location_type" CHECK ("type" IN ('HO', 'SITE', 'WORKSHOP', 'GUDANG', 'MESS'));
ALTER TABLE "Asset" ADD CONSTRAINT "asset_quantity" CHECK ("quantity" >= 1);
ALTER TABLE "Asset" ADD CONSTRAINT "asset_source" CHECK ("acquisitionSource" IN ('PEMBELIAN', 'DATA_AWAL', 'HIBAH', 'BUATAN_WORKSHOP'));
ALTER TABLE "Asset" ADD CONSTRAINT "asset_ownership" CHECK ("ownership" IN ('MILIK', 'TITIPAN', 'SEWA'));
ALTER TABLE "Asset" ADD CONSTRAINT "asset_status" CHECK ("status" IN ('AKTIF', 'DALAM_PERBAIKAN', 'TIDAK_DIPAKAI'));
ALTER TABLE "Asset" ADD CONSTRAINT "asset_condition" CHECK ("condition" IN ('BAIK', 'PERLU_PERBAIKAN', 'RUSAK', 'HILANG'));

-- Master awal dari register LIST ASSET PJM 2026 Rev 1.xlsx (sheet dan Daftar Isian).
INSERT INTO "AssetCategory" ("code", "name", "seqWidth", "defaultDepreciationClass") VALUES
  ('HSE', 'Peralatan HSE', 4, 'Gol 1'),
  ('BT', 'Bangunan / Tanah', 4, 'Gol 4'),
  ('MPK', 'Mesin & Peralatan kerja', 4, 'Gol 1'),
  ('OF', 'Peralatan kantor', 4, 'Gol 1'),
  ('VEH', 'Kendaraan', 3, 'Gol 2');
INSERT INTO "DepreciationClass" ("code", "rate") VALUES
  ('Gol 1', 0.25), ('Gol 2', 0.125), ('Gol 3', 0.0625), ('Gol 4', 0.05), ('Tidak Permanen', 0.25);
INSERT INTO "AssetLocation" ("id", "code", "name", "type") VALUES
  ('loc_ho', 'HO', 'HO', 'HO'),
  ('loc_workshop', 'WORKSHOP', 'Workshop', 'WORKSHOP'),
  ('loc_angsana', 'ANGSANA', 'Angsana', 'SITE'),
  ('loc_lahat', 'LAHAT', 'Lahat', 'SITE'),
  ('loc_tabang', 'TABANG', 'Tabang', 'SITE'),
  ('loc_katingan', 'KATINGAN', 'Kasongan / Katingan', 'SITE'),
  ('loc_km19', 'KM19', 'KM 19', 'SITE'),
  ('loc_km13', 'KM13', 'KM 13', 'SITE'),
  ('loc_sampit', 'SAMPIT', 'Sampit', 'SITE'),
  ('loc_bukitasam', 'BUKITASAM', 'Bukit Asam', 'SITE'),
  ('loc_mav', 'MAV', 'MAV', 'SITE'),
  ('loc_aceh', 'ACEH', 'Aceh', 'SITE'),
  ('loc_meulaboh', 'MEULABOH', 'Meulaboh', 'SITE'),
  ('loc_vale', 'VALE', 'Vale/Sorowako', 'SITE'),
  ('loc_purukcahu', 'PURUKCAHU', 'Puruk Cahu', 'SITE');

-- Hak akses runtime untuk tabel baru (sama seperti scripts/setup-runtime.mjs), hanya untuk peran lingkungan ini.
DO $$
DECLARE
  r text := CASE WHEN current_schema() = 'public' THEN 'prohaba_runtime' ELSE 'prohaba_runtime_dev' END;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['AssetCategory', 'DepreciationClass', 'AssetLocation', 'Asset'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO %I', t, r);
      IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = current_schema() AND tablename = t AND policyname = r || '_access') THEN
        EXECUTE format('CREATE POLICY %I ON %I TO %I USING (true) WITH CHECK (true)', r || '_access', t, r);
      END IF;
    END IF;
  END LOOP;
END $$;
COMMIT;
