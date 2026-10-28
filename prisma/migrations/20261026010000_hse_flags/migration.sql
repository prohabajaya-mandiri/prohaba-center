BEGIN;
-- Tanda HSE (MCU tidak berlaku, SIMPER/KIMPER tidak berlaku) pada absensi barcode dan pengambilan BBM. Aditif; tidak memblokir.
-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "hseHealthSyncedAt" TIMESTAMP(3),
ADD COLUMN     "mcuResult" TEXT,
ADD COLUMN     "mcuValidUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AttendanceScan" ADD COLUMN     "hseFlags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "FuelLog" ADD COLUMN     "hseFlags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "EmployeePermit" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "hseSiteId" TEXT NOT NULL,
    "permitType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeePermit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeePermit_employeeId_endDate_idx" ON "EmployeePermit"("employeeId", "endDate");

-- AddForeignKey
ALTER TABLE "EmployeePermit" ADD CONSTRAINT "EmployeePermit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hak akses runtime untuk tabel baru (sama seperti scripts/setup-runtime.mjs), hanya untuk peran lingkungan ini.
DO $$
DECLARE
  r text := CASE WHEN current_schema() = 'public' THEN 'prohaba_runtime' ELSE 'prohaba_runtime_dev' END;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['EmployeePermit'] LOOP
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
