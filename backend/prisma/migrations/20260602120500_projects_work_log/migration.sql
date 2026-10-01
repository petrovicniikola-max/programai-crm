-- Projects + work log (tenant-scoped)
CREATE TABLE IF NOT EXISTS "Project" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectAssignment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectWorkOrder" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "hours" DOUBLE PRECISION NOT NULL,
  "workDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectWorkOrder_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "Project"
  ADD CONSTRAINT "Project_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectAssignment"
  ADD CONSTRAINT "ProjectAssignment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAssignment"
  ADD CONSTRAINT "ProjectAssignment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAssignment"
  ADD CONSTRAINT "ProjectAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectWorkOrder"
  ADD CONSTRAINT "ProjectWorkOrder_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectWorkOrder"
  ADD CONSTRAINT "ProjectWorkOrder_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectWorkOrder"
  ADD CONSTRAINT "ProjectWorkOrder_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Uniques + indexes
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectAssignment_tenantId_projectId_userId_key"
  ON "ProjectAssignment"("tenantId", "projectId", "userId");

CREATE INDEX IF NOT EXISTS "Project_tenantId_startDate_idx" ON "Project"("tenantId", "startDate");
CREATE INDEX IF NOT EXISTS "Project_tenantId_createdAt_idx" ON "Project"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "ProjectAssignment_tenantId_userId_idx" ON "ProjectAssignment"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "ProjectAssignment_tenantId_projectId_idx" ON "ProjectAssignment"("tenantId", "projectId");

CREATE INDEX IF NOT EXISTS "ProjectWorkOrder_tenantId_projectId_workDate_idx"
  ON "ProjectWorkOrder"("tenantId", "projectId", "workDate");
CREATE INDEX IF NOT EXISTS "ProjectWorkOrder_tenantId_userId_workDate_idx"
  ON "ProjectWorkOrder"("tenantId", "userId", "workDate");
CREATE INDEX IF NOT EXISTS "ProjectWorkOrder_tenantId_createdAt_idx"
  ON "ProjectWorkOrder"("tenantId", "createdAt");

