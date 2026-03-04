-- AlterTable TenantSettings: add email provider and password for SMTP sending
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "emailProvider" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "emailPassword" TEXT;
