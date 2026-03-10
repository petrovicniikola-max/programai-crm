-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "receiveLicenceExpiryEmails" BOOLEAN NOT NULL DEFAULT false;

