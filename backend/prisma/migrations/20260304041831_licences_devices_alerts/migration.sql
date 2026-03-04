-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "LicenceStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "name" TEXT,
    "model" TEXT,
    "serialNo" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Licence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "deviceId" TEXT,
    "productName" TEXT NOT NULL,
    "licenceKey" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3) NOT NULL,
    "status" "LicenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Licence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenceEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "licenceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenceNotificationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "licenceId" TEXT NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "triggerDate" TIMESTAMP(3) NOT NULL,
    "recipient" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenceNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Device_tenantId_companyId_updatedAt_idx" ON "Device"("tenantId", "companyId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Device_tenantId_serialNo_key" ON "Device"("tenantId", "serialNo");

-- CreateIndex
CREATE INDEX "Licence_tenantId_validTo_idx" ON "Licence"("tenantId", "validTo");

-- CreateIndex
CREATE INDEX "Licence_tenantId_companyId_validTo_idx" ON "Licence"("tenantId", "companyId", "validTo");

-- CreateIndex
CREATE INDEX "LicenceEvent_tenantId_licenceId_createdAt_idx" ON "LicenceEvent"("tenantId", "licenceId", "createdAt");

-- CreateIndex
CREATE INDEX "LicenceNotificationLog_tenantId_createdAt_idx" ON "LicenceNotificationLog"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LicenceNotificationLog_tenantId_licenceId_daysBefore_trigge_key" ON "LicenceNotificationLog"("tenantId", "licenceId", "daysBefore", "triggerDate");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Licence" ADD CONSTRAINT "Licence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Licence" ADD CONSTRAINT "Licence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Licence" ADD CONSTRAINT "Licence_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenceEvent" ADD CONSTRAINT "LicenceEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenceEvent" ADD CONSTRAINT "LicenceEvent_licenceId_fkey" FOREIGN KEY ("licenceId") REFERENCES "Licence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenceNotificationLog" ADD CONSTRAINT "LicenceNotificationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenceNotificationLog" ADD CONSTRAINT "LicenceNotificationLog_licenceId_fkey" FOREIGN KEY ("licenceId") REFERENCES "Licence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
