BEGIN;
-- Gudang HO tahap 1: kelompok, barang, lokasi, dokumen dan kartu stok. Aditif; belum ada data stok.
-- CreateTable
CREATE TABLE "StockGroup" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "StockGroup_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "unit" TEXT NOT NULL,
    "decimals" BOOLEAN NOT NULL DEFAULT false,
    "minStock" DECIMAL(14,3),
    "avgCost" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "homeLocationId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL DEFAULT 'HO',
    "parentId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockDocument" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SELESAI',
    "docDate" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT,
    "destination" TEXT,
    "takerEmployeeId" TEXT,
    "takerName" TEXT,
    "vehicleNo" TEXT,
    "driverName" TEXT,
    "notes" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(20,2) NOT NULL,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_sku_key" ON "StockItem"("sku");

-- CreateIndex
CREATE INDEX "StockItem_groupCode_name_idx" ON "StockItem"("groupCode", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StockLocation_code_key" ON "StockLocation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StockDocument_number_key" ON "StockDocument"("number");

-- CreateIndex
CREATE INDEX "StockDocument_type_docDate_idx" ON "StockDocument"("type", "docDate");

-- CreateIndex
CREATE INDEX "StockDocument_projectId_docDate_idx" ON "StockDocument"("projectId", "docDate");

-- CreateIndex
CREATE INDEX "StockMovement_itemId_locationId_idx" ON "StockMovement"("itemId", "locationId");

-- CreateIndex
CREATE INDEX "StockMovement_locationId_idx" ON "StockMovement"("locationId");

-- CreateIndex
CREATE INDEX "StockMovement_documentId_idx" ON "StockMovement"("documentId");

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_groupCode_fkey" FOREIGN KEY ("groupCode") REFERENCES "StockGroup"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_homeLocationId_fkey" FOREIGN KEY ("homeLocationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDocument" ADD CONSTRAINT "StockDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDocument" ADD CONSTRAINT "StockDocument_takerEmployeeId_fkey" FOREIGN KEY ("takerEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDocument" ADD CONSTRAINT "StockDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StockDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockLocation" ADD CONSTRAINT "stock_location_type" CHECK ("type" IN ('RAK', 'BIN', 'LANTAI', 'PENAMPUNG'));
ALTER TABLE "StockDocument" ADD CONSTRAINT "stock_document_type" CHECK ("type" IN ('SALDO_AWAL', 'MASUK', 'KELUAR', 'RETUR', 'PINDAH'));
ALTER TABLE "StockDocument" ADD CONSTRAINT "stock_document_status" CHECK ("status" IN ('SELESAI', 'DIBATALKAN'));
ALTER TABLE "StockMovement" ADD CONSTRAINT "stock_movement_qty" CHECK ("qty" <> 0);

-- Kelompok barang (docs/gudang-ho.md) dan lokasi penampung untuk saldo awal sebelum penataan rak.
INSERT INTO "StockGroup" ("code", "name") VALUES
  ('SAN', 'Sanitair'),
  ('PPR', 'Fitting pipa PPR'),
  ('PVC', 'Fitting pipa PVC'),
  ('PJD', 'Aksesoris pintu & jendela'),
  ('ELC', 'Electrical'),
  ('PLB', 'Plumbing & hydrant'),
  ('KIM', 'Bahan kimia & cat'),
  ('APD', 'Alat pelindung diri'),
  ('UMM', 'Barang umum & material lain');
INSERT INTO "StockLocation" ("id", "code", "type", "description") VALUES
  ('stockloc_holding', 'HO-PENAMPUNG', 'PENAMPUNG', 'Barang belum ditata ke rak (saldo awal)');

-- Hak akses runtime untuk tabel baru (sama seperti scripts/setup-runtime.mjs), hanya untuk peran lingkungan ini.
DO $$
DECLARE
  r text := CASE WHEN current_schema() = 'public' THEN 'prohaba_runtime' ELSE 'prohaba_runtime_dev' END;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['StockGroup', 'StockItem', 'StockLocation', 'StockDocument', 'StockMovement'] LOOP
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
