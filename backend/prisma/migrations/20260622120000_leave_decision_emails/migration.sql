-- Email recipients for annual leave decision (Word) after approval
ALTER TABLE "TenantLeaveSettings" ADD COLUMN IF NOT EXISTS "decisionNotificationEmails" JSONB NOT NULL DEFAULT '["estuar@estuar.rs","racunovodstvo@estuar.rs"]';
