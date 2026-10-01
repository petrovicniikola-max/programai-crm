-- CreateEnum
CREATE TYPE "EmploymentContractType" AS ENUM ('INDEFINITE', 'FIXED_TERM');
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'PAID_ABSENCE', 'PERSONAL');
CREATE TYPE "LeaveRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVISION', 'CANCELLED');
CREATE TYPE "PaidAbsenceSubtype" AS ENUM ('MARRIAGE', 'CHILD_BIRTH', 'FAMILY_SERIOUS_ILLNESS', 'FAMILY_DEATH', 'BLOOD_DONATION', 'OTHER');
CREATE TYPE "LeaveEntitlementKind" AS ENUM ('CURRENT', 'PREVIOUS');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "employmentDate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "leaveApproverId" TEXT;
ALTER TABLE "User" ADD COLUMN "totalWorkExperienceYears" INTEGER;
ALTER TABLE "User" ADD COLUMN "jobTitle" TEXT;
ALTER TABLE "User" ADD COLUMN "employmentContractType" "EmploymentContractType" NOT NULL DEFAULT 'INDEFINITE';
ALTER TABLE "User" ADD COLUMN "contractEndDate" TIMESTAMP(3);

CREATE INDEX "User_tenantId_leaveApproverId_idx" ON "User"("tenantId", "leaveApproverId");

ALTER TABLE "User" ADD CONSTRAINT "User_leaveApproverId_fkey" FOREIGN KEY ("leaveApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TenantLeaveSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "defaultApproverId" TEXT,
    "minAnnualDays" INTEGER NOT NULL DEFAULT 20,
    "personalDaysPerYear" INTEGER NOT NULL DEFAULT 5,
    "paidAbsenceMaxDays" INTEGER NOT NULL DEFAULT 5,
    "seniorityBonusTable" JSONB NOT NULL DEFAULT '[]',
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 7,
    "fiscalYearEndMonth" INTEGER NOT NULL DEFAULT 6,
    "reminderAfterMonthDay" TEXT NOT NULL DEFAULT '04-30',
    "companyAddress" TEXT,
    "companyCity" TEXT,
    "decisionSeqYear" INTEGER,
    "decisionSeqCounter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantLeaveSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaveEntitlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entitlementYear" INTEGER NOT NULL,
    "kind" "LeaveEntitlementKind" NOT NULL,
    "baseDays" DOUBLE PRECISION NOT NULL,
    "seniorityBonusDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDays" DOUBLE PRECISION NOT NULL,
    "usedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "paidAbsenceSubtype" "PaidAbsenceSubtype",
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "note" TEXT,
    "totalWorkingDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "approverId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "entitlementId" TEXT,
    "documentPath" TEXT,
    "decisionNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaveDayEntry" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "isWeekend" BOOLEAN NOT NULL DEFAULT false,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "countsTowardBalance" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LeaveDayEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantLeaveSettings_tenantId_key" ON "TenantLeaveSettings"("tenantId");
CREATE UNIQUE INDEX "PublicHoliday_tenantId_date_key" ON "PublicHoliday"("tenantId", "date");
CREATE INDEX "PublicHoliday_tenantId_date_idx" ON "PublicHoliday"("tenantId", "date");
CREATE UNIQUE INDEX "LeaveEntitlement_tenantId_userId_entitlementYear_kind_key" ON "LeaveEntitlement"("tenantId", "userId", "entitlementYear", "kind");
CREATE INDEX "LeaveEntitlement_tenantId_userId_idx" ON "LeaveEntitlement"("tenantId", "userId");
CREATE INDEX "LeaveRequest_tenantId_userId_status_idx" ON "LeaveRequest"("tenantId", "userId", "status");
CREATE INDEX "LeaveRequest_tenantId_startDate_endDate_idx" ON "LeaveRequest"("tenantId", "startDate", "endDate");
CREATE INDEX "LeaveRequest_tenantId_status_idx" ON "LeaveRequest"("tenantId", "status");
CREATE UNIQUE INDEX "LeaveDayEntry_leaveRequestId_date_key" ON "LeaveDayEntry"("leaveRequestId", "date");

ALTER TABLE "TenantLeaveSettings" ADD CONSTRAINT "TenantLeaveSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicHoliday" ADD CONSTRAINT "PublicHoliday_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveEntitlement" ADD CONSTRAINT "LeaveEntitlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveEntitlement" ADD CONSTRAINT "LeaveEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "LeaveEntitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeaveDayEntry" ADD CONSTRAINT "LeaveDayEntry_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
