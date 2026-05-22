-- CreateTable
CREATE TABLE "Distributor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Distributor_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Device" ADD COLUMN "distributorId" TEXT;

-- CreateIndex
CREATE INDEX "Distributor_tenantId_name_idx" ON "Distributor"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Distributor_tenantId_name_key" ON "Distributor"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "Distributor" ADD CONSTRAINT "Distributor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
