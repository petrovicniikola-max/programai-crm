-- CreateEnum
CREATE TYPE "ProjectWorkOrderType" AS ENUM ('REKLAMACIJA', 'IMPLEMENTACIJA');

-- AlterTable
ALTER TABLE "ProjectWorkOrder" ADD COLUMN "type" "ProjectWorkOrderType",
ADD COLUMN "contractNumber" TEXT,
ADD COLUMN "requestedWork" TEXT,
ADD COLUMN "performedWork" TEXT;

-- CreateTable
CREATE TABLE "ProjectWorkOrderLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kom',
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "priceWithVat" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectWorkOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectWorkOrderLine_tenantId_workOrderId_idx" ON "ProjectWorkOrderLine"("tenantId", "workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectWorkOrderLine_workOrderId_code_key" ON "ProjectWorkOrderLine"("workOrderId", "code");

-- AddForeignKey
ALTER TABLE "ProjectWorkOrderLine" ADD CONSTRAINT "ProjectWorkOrderLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWorkOrderLine" ADD CONSTRAINT "ProjectWorkOrderLine_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "ProjectWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
