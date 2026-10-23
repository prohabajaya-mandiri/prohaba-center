BEGIN;
-- Satu master site: proyek ERP ditautkan ke Site E-HSE; penugasan diturunkan dari salinan penempatan E-HSE.
-- Aditif, kecuali unik (employeeId, projectId) diganti indeks biasa agar satu karyawan boleh punya beberapa periode di proyek yang sama.
-- DropIndex
DROP INDEX "EmployeeProject_employeeId_projectId_key";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "hseSiteCode" TEXT,
ADD COLUMN     "hseSiteId" TEXT,
ADD COLUMN     "hseSiteName" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "hseSiteId" TEXT,
ADD COLUMN     "hseSiteIsHo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "placementsSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EmployeeProject" ADD COLUMN     "placementId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "EmployeePlacement" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "hseSiteId" TEXT NOT NULL,
    "siteCode" TEXT NOT NULL,
    "siteIsHo" BOOLEAN NOT NULL DEFAULT false,
    "position" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,

    CONSTRAINT "EmployeePlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeePlacement_employeeId_startDate_idx" ON "EmployeePlacement"("employeeId", "startDate");

-- CreateIndex
CREATE INDEX "EmployeePlacement_hseSiteId_status_idx" ON "EmployeePlacement"("hseSiteId", "status");

-- CreateIndex
CREATE INDEX "Project_hseSiteId_status_idx" ON "Project"("hseSiteId", "status");

-- CreateIndex
CREATE INDEX "Employee_hseSiteId_idx" ON "Employee"("hseSiteId");

-- CreateIndex
CREATE INDEX "EmployeeProject_employeeId_projectId_idx" ON "EmployeeProject"("employeeId", "projectId");

-- AddForeignKey
ALTER TABLE "EmployeePlacement" ADD CONSTRAINT "EmployeePlacement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "EmployeeProject" ADD CONSTRAINT "employee_project_source" CHECK ("source" IN ('MANUAL', 'PLACEMENT'));
ALTER TABLE "EmployeePlacement" ADD CONSTRAINT "employee_placement_status" CHECK ("status" IN ('ACTIVE', 'ENDED'));

-- Hak akses runtime untuk tabel baru (sama seperti scripts/setup-runtime.mjs), hanya untuk peran lingkungan ini.
DO $$
DECLARE
  r text := CASE WHEN current_schema() = 'public' THEN 'prohaba_runtime' ELSE 'prohaba_runtime_dev' END;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['EmployeePlacement'] LOOP
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
