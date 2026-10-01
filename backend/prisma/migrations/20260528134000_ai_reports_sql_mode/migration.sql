-- CreateEnum
CREATE TYPE "AiReportMode" AS ENUM ('TEMPLATE', 'SQL');

-- AlterTable
ALTER TABLE "AiReport" ADD COLUMN "mode" "AiReportMode" NOT NULL DEFAULT 'TEMPLATE';
ALTER TABLE "AiReport" ADD COLUMN "sqlText" TEXT;

