-- CreateTable
CREATE TABLE "TodoTeam" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "extraRecipients" JSONB NOT NULL DEFAULT '[]',
    "reminderTime" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoTeamMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TodoTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoTeamNotificationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sentOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TodoTeamNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TodoTeam_tenantId_isActive_idx" ON "TodoTeam"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "TodoTeamMember_tenantId_userId_idx" ON "TodoTeamMember"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "TodoTeamMember_teamId_idx" ON "TodoTeamMember"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TodoTeamMember_teamId_userId_key" ON "TodoTeamMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX "TodoTeamNotificationLog_tenantId_sentOn_idx" ON "TodoTeamNotificationLog"("tenantId", "sentOn");

-- CreateIndex
CREATE UNIQUE INDEX "TodoTeamNotificationLog_teamId_sentOn_key" ON "TodoTeamNotificationLog"("teamId", "sentOn");

-- AddForeignKey
ALTER TABLE "TodoTeam" ADD CONSTRAINT "TodoTeam_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoTeamMember" ADD CONSTRAINT "TodoTeamMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoTeamMember" ADD CONSTRAINT "TodoTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TodoTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoTeamMember" ADD CONSTRAINT "TodoTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoTeamNotificationLog" ADD CONSTRAINT "TodoTeamNotificationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoTeamNotificationLog" ADD CONSTRAINT "TodoTeamNotificationLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TodoTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
