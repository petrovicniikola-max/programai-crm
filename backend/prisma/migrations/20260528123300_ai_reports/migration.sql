-- CreateEnum
CREATE TYPE "AiReportScheduleType" AS ENUM (
  'DAILY',
  'EVERY_7_DAYS',
  'EVERY_15_DAYS',
  'MONTHLY_FIRST_DAY',
  'MONTHLY_LAST_DAY'
);

-- CreateEnum
CREATE TYPE "AiReportRunStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "AiReport" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "promptText" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "params" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReportSchedule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "aiReportId" TEXT NOT NULL,
  "recipients" JSONB NOT NULL DEFAULT '[]',
  "scheduleType" "AiReportScheduleType" NOT NULL,
  "scheduleTime" TEXT NOT NULL DEFAULT '08:00',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt" TIMESTAMP(3),
  "nextRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReportRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "aiReportId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "status" "AiReportRunStatus" NOT NULL,
  "rowCount" INTEGER,
  "errorMessage" TEXT,

  CONSTRAINT "AiReportRun_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "AiReport_tenantId_createdAt_idx" ON "AiReport"("tenantId", "createdAt");
CREATE INDEX "AiReportSchedule_tenantId_nextRunAt_idx" ON "AiReportSchedule"("tenantId", "nextRunAt");
CREATE INDEX "AiReportSchedule_aiReportId_idx" ON "AiReportSchedule"("aiReportId");
CREATE INDEX "AiReportRun_tenantId_startedAt_idx" ON "AiReportRun"("tenantId", "startedAt");
CREATE INDEX "AiReportRun_aiReportId_startedAt_idx" ON "AiReportRun"("aiReportId", "startedAt");

-- FKs
ALTER TABLE "AiReport" ADD CONSTRAINT "AiReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiReportSchedule" ADD CONSTRAINT "AiReportSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiReportSchedule" ADD CONSTRAINT "AiReportSchedule_aiReportId_fkey" FOREIGN KEY ("aiReportId") REFERENCES "AiReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiReportRun" ADD CONSTRAINT "AiReportRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiReportRun" ADD CONSTRAINT "AiReportRun_aiReportId_fkey" FOREIGN KEY ("aiReportId") REFERENCES "AiReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

