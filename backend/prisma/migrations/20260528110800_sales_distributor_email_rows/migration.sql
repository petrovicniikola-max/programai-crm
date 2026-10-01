-- CreateTable
CREATE TABLE "SalesDistributorEmailRow" (
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
    "nbsStatus" TEXT,
    "creditRating" TEXT,
    "size" TEXT,
    "revenueEur" TEXT,
    "netProfitEur" TEXT,
    "employeesCount" TEXT,
    "ebitEur" TEXT,
    "ebitdaEur" TEXT,
    "email" TEXT,
    "representative" TEXT,
    "vatRegistered" TEXT,
    "fieldColors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesDistributorEmailRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesDistributorEmailRow_tenantId_externalKey_key" ON "SalesDistributorEmailRow"("tenantId", "externalKey");
CREATE INDEX "SalesDistributorEmailRow_tenantId_updatedAt_idx" ON "SalesDistributorEmailRow"("tenantId", "updatedAt");
CREATE INDEX "SalesDistributorEmailRow_tenantId_createdAt_idx" ON "SalesDistributorEmailRow"("tenantId", "createdAt");

ALTER TABLE "SalesDistributorEmailRow" ADD CONSTRAINT "SalesDistributorEmailRow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

