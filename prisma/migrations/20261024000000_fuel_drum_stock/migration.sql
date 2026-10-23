BEGIN;
-- BBM drum site: pengiriman HO, pengeluaran oleh petugas BBM, stock opname, pengajuan. Aditif; data FuelLog lama tetap (source MANUAL).
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "siteProjectId" TEXT;

-- AlterTable
ALTER TABLE "FuelLog" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "method" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "runHours" DOUBLE PRECISION,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "takerName" TEXT,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedBy" TEXT;

-- CreateTable
CREATE TABLE "FuelPhoto" (
    "fuelLogId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "FuelPhoto_pkey" PRIMARY KEY ("fuelLogId")
);

-- CreateTable
CREATE TABLE "FuelShipment" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestId" TEXT,
    "fuelType" TEXT NOT NULL DEFAULT 'SOLAR',
    "drums" INTEGER NOT NULL,
    "liters" DOUBLE PRECISION NOT NULL,
    "pricePerLiter" DECIMAL(20,2) NOT NULL,
    "driver" TEXT,
    "plateNumber" TEXT,
    "sealNumbers" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "receivedDrums" INTEGER,
    "receivedLiters" DOUBLE PRECISION,
    "sealIntact" BOOLEAN,
    "receiveNotes" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedBy" TEXT,
    "receiveClientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelStockCount" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "countedAt" TIMESTAMP(3) NOT NULL,
    "fullDrums" INTEGER NOT NULL,
    "openLiters" DOUBLE PRECISION NOT NULL,
    "totalLiters" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "countedBy" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelStockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelRequest" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "drums" INTEGER NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "stockLiters" DOUBLE PRECISION NOT NULL,
    "usage14d" DOUBLE PRECISION NOT NULL,
    "lastCountAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FuelShipment_number_key" ON "FuelShipment"("number");

-- CreateIndex
CREATE UNIQUE INDEX "FuelShipment_requestId_key" ON "FuelShipment"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "FuelShipment_receiveClientId_key" ON "FuelShipment"("receiveClientId");

-- CreateIndex
CREATE INDEX "FuelShipment_projectId_status_idx" ON "FuelShipment"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FuelStockCount_clientId_key" ON "FuelStockCount"("clientId");

-- CreateIndex
CREATE INDEX "FuelStockCount_projectId_countedAt_idx" ON "FuelStockCount"("projectId", "countedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FuelRequest_number_key" ON "FuelRequest"("number");

-- CreateIndex
CREATE UNIQUE INDEX "FuelRequest_clientId_key" ON "FuelRequest"("clientId");

-- CreateIndex
CREATE INDEX "FuelRequest_projectId_status_idx" ON "FuelRequest"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FuelLog_clientId_key" ON "FuelLog"("clientId");

-- CreateIndex
CREATE INDEX "FuelLog_employeeId_date_idx" ON "FuelLog"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_siteProjectId_fkey" FOREIGN KEY ("siteProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelLog" ADD CONSTRAINT "FuelLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelPhoto" ADD CONSTRAINT "FuelPhoto_fuelLogId_fkey" FOREIGN KEY ("fuelLogId") REFERENCES "FuelLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelShipment" ADD CONSTRAINT "FuelShipment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelShipment" ADD CONSTRAINT "FuelShipment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "FuelRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelShipment" ADD CONSTRAINT "FuelShipment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelShipment" ADD CONSTRAINT "FuelShipment_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelStockCount" ADD CONSTRAINT "FuelStockCount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelStockCount" ADD CONSTRAINT "FuelStockCount_countedBy_fkey" FOREIGN KEY ("countedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelRequest" ADD CONSTRAINT "FuelRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelRequest" ADD CONSTRAINT "FuelRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "FuelLog" ADD CONSTRAINT "fuel_log_source" CHECK ("source" IN ('MANUAL', 'DRUM'));
ALTER TABLE "FuelLog" ADD CONSTRAINT "fuel_log_method" CHECK ("method" IS NULL OR "method" IN ('FLOW_METER', 'TAKARAN', 'PERKIRAAN'));
ALTER TABLE "FuelShipment" ADD CONSTRAINT "fuel_shipment_status" CHECK ("status" IN ('SENT', 'RECEIVED', 'CANCELLED'));
ALTER TABLE "FuelRequest" ADD CONSTRAINT "fuel_request_status" CHECK ("status" IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'SHIPPED'));

-- Hak akses runtime untuk tabel baru (sama seperti scripts/setup-runtime.mjs), hanya untuk peran lingkungan ini.
DO $$
DECLARE
  r text := CASE WHEN current_schema() = 'public' THEN 'prohaba_runtime' ELSE 'prohaba_runtime_dev' END;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['FuelPhoto', 'FuelShipment', 'FuelStockCount', 'FuelRequest'] LOOP
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
