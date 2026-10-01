-- Evidencija prodatih uređaja (tehnički tim).

CREATE TABLE "SoldDevice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serialNo" TEXT NOT NULL,
    "name" TEXT,
    "licenceName" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoldDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SoldDevice_tenantId_serialNo_key" ON "SoldDevice"("tenantId", "serialNo");
CREATE INDEX "SoldDevice_tenantId_createdAt_idx" ON "SoldDevice"("tenantId", "createdAt");

ALTER TABLE "SoldDevice" ADD CONSTRAINT "SoldDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SoldDevice" ADD CONSTRAINT "SoldDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PermissionResource" ("id", "key", "label", "groupKey", "sortOrder")
VALUES ('rbac_res_sold_devices', 'soldDevices', 'Prodati uređaji', NULL, 260);

INSERT INTO "RolePermission" ("id", "roleId", "resourceId", "canView", "canEdit")
SELECT 'rbac_rp_' || r."slug" || '_soldDevices', r."id", pr."id", true, true
FROM "Role" r
CROSS JOIN "PermissionResource" pr
WHERE r."slug" IN ('SUPPORT', 'SUPER_ADMIN')
  AND pr."key" = 'soldDevices'
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."resourceId" = pr."id"
  );

UPDATE "Role"
SET "permissionsVersion" = "permissionsVersion" + 1
WHERE "slug" IN ('SUPPORT', 'SUPER_ADMIN');
