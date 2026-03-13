-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "reportEmailConfigs" JSONB;
