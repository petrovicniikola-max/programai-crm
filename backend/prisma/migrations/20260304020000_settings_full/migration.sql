-- AlterEnum: rename UserRole values (PostgreSQL 10+)
ALTER TYPE "UserRole" RENAME VALUE 'ADMIN' TO 'SUPER_ADMIN';
ALTER TYPE "UserRole" RENAME VALUE 'AGENT' TO 'SUPPORT';

-- CreateEnum TicketPriority
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable TenantSettings: add white-label, email, notifications, security
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "brandName" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "primaryColour" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "emailSignature" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "emailFromName" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "emailFromAddress" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "notificationsDaysBefore" JSONB;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "jwtAccessTtlMinutes" INTEGER DEFAULT 10080;

-- AlterTable User: add displayName, isActive
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable TicketSettings
CREATE TABLE "TicketSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "defaultStatus" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "defaultType" "TicketType" NOT NULL DEFAULT 'CALL',
    "defaultPriority" "TicketPriority" DEFAULT 'MEDIUM',
    "allowedStatuses" JSONB NOT NULL DEFAULT '["OPEN","IN_PROGRESS","DONE"]',
    "allowedTypes" JSONB NOT NULL DEFAULT '["CALL","SUPPORT","SALES","FIELD","OTHER"]',
    "allowedPriorities" JSONB NOT NULL DEFAULT '["LOW","MEDIUM","HIGH"]',
    "autoInProgressOnAssign" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TicketSettings_tenantId_key" ON "TicketSettings"("tenantId");

ALTER TABLE "TicketSettings" ADD CONSTRAINT "TicketSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");
CREATE INDEX "AuditLog_tenantId_action_idx" ON "AuditLog"("tenantId", "action");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
