-- CreateTable
CREATE TABLE "SalesDirectoryRow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "mb" TEXT,
    "pib" TEXT,
    "establishedAt" TIMESTAMP(3),
    "companyName" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "legalForm" TEXT,
    "activityCode" TEXT,
    "activityName" TEXT,
    "aprStatus" TEXT,
    "email" TEXT,
    "representative" TEXT,
    "description" TEXT,
    "sizeClass" TEXT,
    "fieldColors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesDirectoryRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesDirectoryRow_tenantId_externalKey_key" ON "SalesDirectoryRow"("tenantId", "externalKey");
CREATE INDEX "SalesDirectoryRow_tenantId_updatedAt_idx" ON "SalesDirectoryRow"("tenantId", "updatedAt");

ALTER TABLE "SalesDirectoryRow" ADD CONSTRAINT "SalesDirectoryRow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

