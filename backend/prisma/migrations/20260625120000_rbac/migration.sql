-- RBAC: Role, PermissionResource, RolePermission, User.roleId

CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "permissionsVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_slug_key" ON "Role"("slug");

CREATE TABLE "PermissionResource" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "groupKey" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PermissionResource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PermissionResource_key_key" ON "PermissionResource"("key");

CREATE TABLE "RolePermission" (
  "id" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "canView" BOOLEAN NOT NULL DEFAULT false,
  "canEdit" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RolePermission_roleId_resourceId_key" ON "RolePermission"("roleId", "resourceId");
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

ALTER TABLE "RolePermission"
  ADD CONSTRAINT "RolePermission_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission"
  ADD CONSTRAINT "RolePermission_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "PermissionResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD COLUMN "roleId" TEXT;
ALTER TABLE "User"
  ADD CONSTRAINT "User_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- System roles
INSERT INTO "Role" ("id", "slug", "name", "description", "isSystem", "isActive", "sortOrder", "permissionsVersion", "createdAt", "updatedAt") VALUES
  ('rbac_role_super_admin', 'SUPER_ADMIN', 'Super Admin', 'Pun pristup sistemu', true, true, 0, 0, NOW(), NOW()),
  ('rbac_role_support', 'SUPPORT', 'Support', 'Podrška', true, true, 1, 0, NOW(), NOW()),
  ('rbac_role_sales', 'SALES', 'Sales', 'Prodaja', true, true, 2, 0, NOW(), NOW()),
  ('rbac_role_user', 'USER', 'User', 'Korisnik firme', true, true, 3, 0, NOW(), NOW()),
  ('rbac_role_accountant', 'ACCOUNTANT', 'Računovođa', 'Računovodstvo', true, true, 4, 0, NOW(), NOW());

-- Permission catalog
INSERT INTO "PermissionResource" ("id", "key", "label", "groupKey", "sortOrder") VALUES
  ('rbac_res_dashboard', 'dashboard', 'Dashboard', NULL, 10),
  ('rbac_res_todo', 'todo', 'TO DO računovođe', NULL, 20),
  ('rbac_res_tickets', 'tickets', 'Tickets', NULL, 30),
  ('rbac_res_sales', 'sales', 'Prodaja', NULL, 40),
  ('rbac_res_clients', 'clients', 'Korisnici', NULL, 50),
  ('rbac_res_devices', 'devices', 'Devices', NULL, 60),
  ('rbac_res_distributors', 'distributors', 'Distributeri', NULL, 70),
  ('rbac_res_licences', 'licences', 'Licences', NULL, 80),
  ('rbac_res_projects', 'projects', 'Evidencija rada', NULL, 90),
  ('rbac_res_leave', 'leave', 'Odsustva', NULL, 100),
  ('rbac_res_reports_overview', 'reports.overview', 'Reports — pregled', 'reports', 110),
  ('rbac_res_reports_tickets', 'reports.tickets', 'Reports — tiketi', 'reports', 120),
  ('rbac_res_reports_devices', 'reports.devices', 'Reports — uređaji', 'reports', 130),
  ('rbac_res_reports_tables', 'reports.tables', 'Reports — tabele', 'reports', 140),
  ('rbac_res_reports_licences', 'reports.licences', 'Reports — licence', 'reports', 150),
  ('rbac_res_reports_generator', 'reports.generator', 'Reports — AI generator', 'reports', 160),
  ('rbac_res_reports_alerts', 'reports.alerts', 'Reports — alerti', 'reports', 170),
  ('rbac_res_forms', 'forms', 'Forms', NULL, 180),
  ('rbac_res_tables', 'tables', 'Tables', NULL, 190),
  ('rbac_res_settings', 'settings', 'Settings', 'settings', 200),
  ('rbac_res_settings_users', 'settings.users', 'Settings — Users', 'settings', 210),
  ('rbac_res_settings_roles', 'settings.roles', 'Settings — Role', 'settings', 220),
  ('rbac_res_calls', 'calls', 'Quick/Outgoing Call', NULL, 230);

-- Helper: insert role permission if view or edit
-- SUPPORT
INSERT INTO "RolePermission" ("id", "roleId", "resourceId", "canView", "canEdit")
SELECT 'rbac_rp_support_' || pr."key", 'rbac_role_support', pr."id", true, false
FROM "PermissionResource" pr
WHERE pr."key" IN ('dashboard','tickets','clients','devices','distributors','forms','tables','leave',
  'reports.overview','reports.tickets','reports.devices','reports.tables','calls');

UPDATE "RolePermission" SET "canEdit" = true
WHERE "roleId" = 'rbac_role_support' AND "resourceId" IN (
  SELECT "id" FROM "PermissionResource" WHERE "key" IN ('tickets','devices')
);

-- SALES
INSERT INTO "RolePermission" ("id", "roleId", "resourceId", "canView", "canEdit")
SELECT 'rbac_rp_sales_' || pr."key", 'rbac_role_sales', pr."id", true, false
FROM "PermissionResource" pr
WHERE pr."key" IN ('dashboard','tickets','sales','clients','forms','tables','distributors','calls',
  'reports.overview','reports.tickets','reports.tables');

UPDATE "RolePermission" SET "canEdit" = true
WHERE "roleId" = 'rbac_role_sales' AND "resourceId" IN (
  SELECT "id" FROM "PermissionResource" WHERE "key" IN ('sales','forms','tickets','calls')
);

-- USER
INSERT INTO "RolePermission" ("id", "roleId", "resourceId", "canView", "canEdit")
SELECT 'rbac_rp_user_' || pr."key", 'rbac_role_user', pr."id", true, false
FROM "PermissionResource" pr
WHERE pr."key" IN ('dashboard','clients');

UPDATE "RolePermission" SET "canEdit" = true
WHERE "roleId" = 'rbac_role_user' AND "resourceId" IN (
  SELECT "id" FROM "PermissionResource" WHERE "key" = 'clients'
);

-- ACCOUNTANT
INSERT INTO "RolePermission" ("id", "roleId", "resourceId", "canView", "canEdit")
SELECT 'rbac_rp_acc_' || pr."key", 'rbac_role_accountant', pr."id", true, false
FROM "PermissionResource" pr
WHERE pr."key" IN ('dashboard','todo','projects','leave',
  'reports.overview','reports.tickets','reports.devices','reports.tables');

UPDATE "RolePermission" SET "canEdit" = true
WHERE "roleId" = 'rbac_role_accountant' AND "resourceId" IN (
  SELECT "id" FROM "PermissionResource" WHERE "key" IN ('todo','projects','leave')
);

-- SUPER_ADMIN: all view+edit (bypass in code, but seed for consistency)
INSERT INTO "RolePermission" ("id", "roleId", "resourceId", "canView", "canEdit")
SELECT 'rbac_rp_admin_' || pr."key", 'rbac_role_super_admin', pr."id", true, true
FROM "PermissionResource" pr;

-- Backfill User.roleId from enum
UPDATE "User" u
SET "roleId" = r."id"
FROM "Role" r
WHERE r."slug" = u."role"::text;
