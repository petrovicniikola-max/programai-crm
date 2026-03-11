-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "reportSchedule" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "reportEmails" JSONB;
