BEGIN;
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "contractValue" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "BOQItem" ALTER COLUMN "costMaterial" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "costLabor" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "totalMaterial" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "totalLabor" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "totalPrice" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "BoqActual" ALTER COLUMN "costActual" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "PurchaseOrder" ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "POItem" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "totalPrice" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "PriceReference" ALTER COLUMN "refPrice" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "SitePurchase" ADD COLUMN     "requestedBy" TEXT,
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "refPrice" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "GLAccount" ADD COLUMN     "purpose" TEXT,
ALTER COLUMN "balance" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "JournalVoucher" ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "referenceKey" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "JournalVoucherItem" ALTER COLUMN "debit" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "credit" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN     "journalVoucherId" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "tax" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "paidAmount" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "PurchasePayment" ADD COLUMN     "bankAccountId" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "journalVoucherId" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "SalesInvoice" ADD COLUMN     "appliedDownPayment" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "dpUsedAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "grossSubTotal" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paidAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
ALTER COLUMN "subTotal" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "taxRate" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "taxAmount" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "Employee" ALTER COLUMN "baseSalary" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "EmployeeProject" ADD COLUMN     "dailyRate" DECIMAL(20,2),
ADD COLUMN     "monthlyRate" DECIMAL(20,2),
ADD COLUMN     "overtimeRate" DECIMAL(20,2),
ADD COLUMN     "payType" TEXT NOT NULL DEFAULT 'UNSET';

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "Payroll" ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "PayrollItem" ALTER COLUMN "baseSalary" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "overtimePay" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "allowances" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "deductions" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "bpjsPay" SET DATA TYPE DECIMAL(20,2),
ALTER COLUMN "netSalary" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "FuelLog" ALTER COLUMN "totalCost" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "MaintenanceLog" ALTER COLUMN "cost" SET DATA TYPE DECIMAL(20,2);

-- CreateTable
CREATE TABLE "SalesReceipt" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "journalVoucherId" TEXT NOT NULL,

    CONSTRAINT "SalesReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PayrollPayment" (
    "id" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "journalVoucherId" TEXT NOT NULL,

    CONSTRAINT "PayrollPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceipt" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "items" JSONB NOT NULL,

    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteReceipt" (
    "sitePurchaseId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "fileName" TEXT NOT NULL,

    CONSTRAINT "SiteReceipt_pkey" PRIMARY KEY ("sitePurchaseId")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesReceipt_reference_key" ON "SalesReceipt"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "SalesReceipt_journalVoucherId_key" ON "SalesReceipt"("journalVoucherId");

-- CreateIndex
CREATE INDEX "LoginAttempt_resetAt_idx" ON "LoginAttempt"("resetAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPayment_payrollId_key" ON "PayrollPayment"("payrollId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPayment_reference_key" ON "PayrollPayment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPayment_journalVoucherId_key" ON "PayrollPayment"("journalVoucherId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReceipt_reference_key" ON "PurchaseReceipt"("reference");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_poId_idx" ON "PurchaseReceipt"("poId");

-- CreateIndex
CREATE INDEX "BOQItem_projectId_sortOrder_idx" ON "BOQItem"("projectId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BOQItem_projectId_code_key" ON "BOQItem"("projectId", "code");

-- CreateIndex
CREATE INDEX "BoqActual_projectId_month_idx" ON "BoqActual"("projectId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "BoqActual_boqItemId_month_key" ON "BoqActual"("boqItemId", "month");

-- CreateIndex
CREATE INDEX "SCurveBaseline_projectId_date_idx" ON "SCurveBaseline"("projectId", "date");

-- CreateIndex
CREATE INDEX "ProgressItem_projectId_reportDate_idx" ON "ProgressItem"("projectId", "reportDate");

-- CreateIndex
CREATE INDEX "Document_projectId_createdAt_idx" ON "Document"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "MaterialRequest_projectId_status_idx" ON "MaterialRequest"("projectId", "status");

-- CreateIndex
CREATE INDEX "MRItem_mrId_idx" ON "MRItem"("mrId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_projectId_status_idx" ON "PurchaseOrder"("projectId", "status");

-- CreateIndex
CREATE INDEX "POItem_poId_idx" ON "POItem"("poId");

-- CreateIndex
CREATE INDEX "SitePurchase_projectId_purchaseDate_idx" ON "SitePurchase"("projectId", "purchaseDate");

-- CreateIndex
CREATE INDEX "PurchaseFlag_sitePurchaseId_idx" ON "PurchaseFlag"("sitePurchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "GLAccount_purpose_key" ON "GLAccount"("purpose");

-- CreateIndex
CREATE UNIQUE INDEX "JournalVoucher_referenceKey_key" ON "JournalVoucher"("referenceKey");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_journalVoucherId_key" ON "PurchaseInvoice"("journalVoucherId");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_projectId_dueDate_idx" ON "PurchaseInvoice"("projectId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "PurchasePayment_idempotencyKey_key" ON "PurchasePayment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PurchasePayment_journalVoucherId_key" ON "PurchasePayment"("journalVoucherId");

-- CreateIndex
CREATE INDEX "PurchasePayment_invoiceId_payDate_idx" ON "PurchasePayment"("invoiceId", "payDate");

-- CreateIndex
CREATE INDEX "SalesInvoice_projectId_date_idx" ON "SalesInvoice"("projectId", "date");

-- CreateIndex
CREATE INDEX "EmployeeProject_projectId_startDate_idx" ON "EmployeeProject"("projectId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProject_employeeId_projectId_key" ON "EmployeeProject"("employeeId", "projectId");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_employeeId_date_key" ON "Attendance"("employeeId", "date");

-- CreateIndex
CREATE INDEX "Payroll_status_createdAt_idx" ON "Payroll"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_projectId_period_key" ON "Payroll"("projectId", "period");

-- CreateIndex
CREATE INDEX "PayrollItem_payrollId_idx" ON "PayrollItem"("payrollId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollApproval_payrollId_role_key" ON "PayrollApproval"("payrollId", "role");

-- CreateIndex
CREATE INDEX "CuttingList_fabricationOrderId_idx" ON "CuttingList"("fabricationOrderId");

-- CreateIndex
CREATE INDEX "DeliveryTicket_fabricationOrderId_status_idx" ON "DeliveryTicket"("fabricationOrderId", "status");

-- CreateIndex
CREATE INDEX "FuelLog_projectId_date_idx" ON "FuelLog"("projectId", "date");

-- CreateIndex
CREATE INDEX "FuelLog_vehicleId_date_idx" ON "FuelLog"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "MaintenanceLog_vehicleId_date_idx" ON "MaintenanceLog"("vehicleId", "date");

-- AddForeignKey
ALTER TABLE "SitePurchase" ADD CONSTRAINT "SitePurchase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReceipt" ADD CONSTRAINT "SalesReceipt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalesReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentSequence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoginAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BoqActual" ADD CONSTRAINT "actual_progress_range" CHECK ("progressPct" BETWEEN 0 AND 100);
ALTER TABLE "Attendance" ADD CONSTRAINT "attendance_overtime_range" CHECK ("overtime" BETWEEN 0 AND 24);
UPDATE "SalesInvoice" SET "grossSubTotal"="subTotal";
COMMIT;
