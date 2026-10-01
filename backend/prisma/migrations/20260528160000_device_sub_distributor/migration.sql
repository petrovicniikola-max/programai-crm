-- Add sub-distributor field to Device
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "subDistributorName" TEXT;

-- Optional: index for quick filtering / searching
CREATE INDEX IF NOT EXISTS "Device_tenantId_subDistributorName_idx"
ON "Device" ("tenantId", "subDistributorName");

