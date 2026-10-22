BEGIN;
-- Absensi lapangan offline: scan dari HP PIC dikirim belakangan, dengan id dari HP agar pengiriman ulang tidak dobel.
ALTER TABLE "AttendanceScan" ADD COLUMN "clientId" TEXT,
ADD COLUMN "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "scannedAt" DROP DEFAULT;

UPDATE "AttendanceScan" SET "clientId" = "id", "receivedAt" = "scannedAt" WHERE "clientId" IS NULL;
ALTER TABLE "AttendanceScan" ALTER COLUMN "clientId" SET NOT NULL;

CREATE UNIQUE INDEX "AttendanceScan_clientId_key" ON "AttendanceScan"("clientId");
COMMIT;
