BEGIN;
-- Master karyawan disatukan: E-HSE menjadi sumber data, Employee menjadi salinan lokal yang tertaut.
-- Perubahan aditif; data lama tetap ada dan dapat ditautkan berdasarkan NIK.
ALTER TABLE "Employee" ADD COLUMN "personnelId" TEXT,
ADD COLUMN "nikLast4" TEXT,
ADD COLUMN "category" TEXT,
ADD COLUMN "siteCode" TEXT,
ADD COLUMN "siteName" TEXT,
ADD COLUMN "workStatus" TEXT,
ADD COLUMN "employmentType" TEXT,
ADD COLUMN "contractEndDate" TIMESTAMP(3),
ADD COLUMN "phoneWa" TEXT,
ADD COLUMN "hseUpdatedAt" TIMESTAMP(3),
ADD COLUMN "syncedAt" TIMESTAMP(3),
ALTER COLUMN "nik" DROP NOT NULL,
ALTER COLUMN "department" DROP NOT NULL,
ALTER COLUMN "employeeType" DROP NOT NULL,
ALTER COLUMN "baseSalary" SET DEFAULT 0,
ALTER COLUMN "joinDate" DROP NOT NULL;

UPDATE "Employee" SET "nikLast4" = RIGHT("nik", 4) WHERE "nik" IS NOT NULL;

CREATE UNIQUE INDEX "Employee_personnelId_key" ON "Employee"("personnelId");
CREATE INDEX "Employee_isActive_name_idx" ON "Employee"("isActive", "name");
CREATE INDEX "Employee_hseUpdatedAt_idx" ON "Employee"("hseUpdatedAt");
COMMIT;
