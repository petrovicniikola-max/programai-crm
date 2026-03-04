-- AlterTable Company: add display key (e.g. C-000001)
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "key" TEXT;

-- CreateIndex: unique (tenantId, key); multiple NULLs allowed in PostgreSQL
CREATE UNIQUE INDEX "Company_tenantId_key_key" ON "Company"("tenantId", "key");

-- AlterTable Form: add display key (e.g. F-000001)
ALTER TABLE "Form" ADD COLUMN IF NOT EXISTS "key" TEXT;

CREATE UNIQUE INDEX "Form_tenantId_key_key" ON "Form"("tenantId", "key");

-- AlterTable FormSubmission: add display key (e.g. Ta-000001)
ALTER TABLE "FormSubmission" ADD COLUMN IF NOT EXISTS "key" TEXT;

CREATE UNIQUE INDEX "FormSubmission_tenantId_key_key" ON "FormSubmission"("tenantId", "key");
