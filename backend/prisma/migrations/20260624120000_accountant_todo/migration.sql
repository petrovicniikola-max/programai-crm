-- Accountant role + TO DO module
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ACCOUNTANT';

CREATE TYPE "AccountantTodoStatus" AS ENUM ('ACTIVE', 'COMPLETED');

CREATE TABLE "AccountantTodo" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "dueDate" DATE,
  "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  "status" "AccountantTodoStatus" NOT NULL DEFAULT 'ACTIVE',
  "completedAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountantTodo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantAccountantTodoSettings" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "extraRecipients" JSONB NOT NULL DEFAULT '[]',
  "reminderTime" TEXT NOT NULL DEFAULT '08:00',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantAccountantTodoSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountantTodoNotificationLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sentOn" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountantTodoNotificationLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AccountantTodo"
  ADD CONSTRAINT "AccountantTodo_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountantTodo"
  ADD CONSTRAINT "AccountantTodo_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantAccountantTodoSettings"
  ADD CONSTRAINT "TenantAccountantTodoSettings_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountantTodoNotificationLog"
  ADD CONSTRAINT "AccountantTodoNotificationLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "TenantAccountantTodoSettings_tenantId_key" ON "TenantAccountantTodoSettings"("tenantId");
CREATE UNIQUE INDEX "AccountantTodoNotificationLog_tenantId_sentOn_key" ON "AccountantTodoNotificationLog"("tenantId", "sentOn");
CREATE INDEX "AccountantTodo_tenantId_userId_status_idx" ON "AccountantTodo"("tenantId", "userId", "status");
CREATE INDEX "AccountantTodo_tenantId_status_dueDate_idx" ON "AccountantTodo"("tenantId", "status", "dueDate");
CREATE INDEX "AccountantTodoNotificationLog_tenantId_sentOn_idx" ON "AccountantTodoNotificationLog"("tenantId", "sentOn");
