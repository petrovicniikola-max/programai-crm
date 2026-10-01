-- CreateTable
CREATE TABLE "LeaveBalanceAdjustment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "occurredOn" DATE NOT NULL,
    "comment" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveBalanceAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeaveBalanceAdjustment_tenantId_userId_type_idx" ON "LeaveBalanceAdjustment"("tenantId", "userId", "type");
CREATE INDEX "LeaveBalanceAdjustment_tenantId_occurredOn_idx" ON "LeaveBalanceAdjustment"("tenantId", "occurredOn");

ALTER TABLE "LeaveBalanceAdjustment" ADD CONSTRAINT "LeaveBalanceAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveBalanceAdjustment" ADD CONSTRAINT "LeaveBalanceAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveBalanceAdjustment" ADD CONSTRAINT "LeaveBalanceAdjustment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
