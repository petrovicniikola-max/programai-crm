-- Project: optional company (client) and distributor
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "distributorId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Project"
    ADD CONSTRAINT "Project_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Project"
    ADD CONSTRAINT "Project_distributorId_fkey"
    FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Project_tenantId_companyId_idx" ON "Project"("tenantId", "companyId");
CREATE INDEX IF NOT EXISTS "Project_tenantId_distributorId_idx" ON "Project"("tenantId", "distributorId");
