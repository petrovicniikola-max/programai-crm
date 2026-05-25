-- Add contactDate column (missing from initial manual/prod table creation)
ALTER TABLE "SalesDirectoryRow" ADD COLUMN IF NOT EXISTS "contactDate" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "SalesDirectoryRow_tenantId_createdAt_idx"
  ON "SalesDirectoryRow"("tenantId", "createdAt");
