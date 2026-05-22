-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "deviceId" TEXT;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Ticket_tenantId_deviceId_idx" ON "Ticket"("tenantId", "deviceId");
