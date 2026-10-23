BEGIN;
-- Koreksi absensi harian oleh HRD: siapa, kapan, dan alasannya. Aditif.
-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "editReason" TEXT,
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "editedBy" TEXT;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_editedBy_fkey" FOREIGN KEY ("editedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
