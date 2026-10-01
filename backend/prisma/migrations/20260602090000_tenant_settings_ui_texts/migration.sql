-- Add UI texts overrides to TenantSettings
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "uiTexts" JSONB;

