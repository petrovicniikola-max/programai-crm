-- Per-user customizable dashboard layout (order, visibility, width)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dashboardLayout" JSONB;
