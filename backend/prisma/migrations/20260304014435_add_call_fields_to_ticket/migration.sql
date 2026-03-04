-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "callDurationMinutes" INTEGER,
ADD COLUMN     "callOccurredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Ticket_tenantId_callOccurredAt_idx" ON "Ticket"("tenantId", "callOccurredAt");
