-- Putni nalozi: evidencija, fajlovi se čuvaju na disku uz nalog.

CREATE TABLE "TravelOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "decisionName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'Beograd',
    "destination" TEXT NOT NULL,
    "hostName" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "transport" TEXT NOT NULL DEFAULT 'Vozilo Estuara',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "departTime" TEXT NOT NULL DEFAULT '08:00',
    "returnTime" TEXT NOT NULL DEFAULT '20:00',
    "dayCount" INTEGER NOT NULL,
    "dailyRate" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "totalInWords" TEXT NOT NULL,
    "decisionDate" DATE NOT NULL,
    "settlementDate" DATE NOT NULL,
    "accountingEmail" TEXT,
    "sentToUser" BOOLEAN NOT NULL DEFAULT false,
    "sentToAccounting" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TravelOrder_tenantId_number_key" ON "TravelOrder"("tenantId", "number");
CREATE INDEX "TravelOrder_tenantId_userId_createdAt_idx" ON "TravelOrder"("tenantId", "userId", "createdAt");

ALTER TABLE "TravelOrder" ADD CONSTRAINT "TravelOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelOrder" ADD CONSTRAINT "TravelOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PermissionResource" ("id", "key", "label", "groupKey", "sortOrder") VALUES
  ('rbac_res_travel_orders', 'travelOrders', 'Putni nalozi', NULL, 240),
  ('rbac_res_travel_orders_all', 'travelOrders.all', 'Putni nalozi — svi (isplata)', NULL, 250);
