BEGIN;
-- Absensi barcode: log setiap scan kartu QR. Aditif; tabel Attendance tidak berubah.
-- CreateTable
CREATE TABLE "AttendanceScan" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeZone" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "scannedBy" TEXT NOT NULL,

    CONSTRAINT "AttendanceScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceScan_employeeId_scannedAt_idx" ON "AttendanceScan"("employeeId", "scannedAt");

-- CreateIndex
CREATE INDEX "AttendanceScan_projectId_date_idx" ON "AttendanceScan"("projectId", "date");

-- CreateIndex
CREATE INDEX "AttendanceScan_date_idx" ON "AttendanceScan"("date");

-- AddForeignKey
ALTER TABLE "AttendanceScan" ADD CONSTRAINT "AttendanceScan_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceScan" ADD CONSTRAINT "AttendanceScan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceScan" ADD CONSTRAINT "AttendanceScan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceScan" ADD CONSTRAINT "AttendanceScan_scannedBy_fkey" FOREIGN KEY ("scannedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttendanceScan" ADD CONSTRAINT "attendance_scan_method" CHECK ("method" IN ('SCANNER', 'KAMERA'));
ALTER TABLE "AttendanceScan" ENABLE ROW LEVEL SECURITY;

-- Hak akses runtime untuk tabel baru (sama seperti scripts/setup-runtime.mjs), hanya untuk peran lingkungan ini.
DO $$
DECLARE r text := CASE WHEN current_schema() = 'public' THEN 'prohaba_runtime' ELSE 'prohaba_runtime_dev' END;
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = r) THEN
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "AttendanceScan" TO %I', r);
    IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'AttendanceScan' AND policyname = r || '_access') THEN
      EXECUTE format('CREATE POLICY %I ON "AttendanceScan" TO %I USING (true) WITH CHECK (true)', r || '_access', r);
    END IF;
  END IF;
END $$;
COMMIT;
