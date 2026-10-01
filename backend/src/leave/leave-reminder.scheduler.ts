import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LeaveEmailService } from './leave-email.service';
import { LeaveBalanceService } from './leave-balance.service';

@Injectable()
export class LeaveReminderScheduler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: LeaveEmailService,
    private readonly balance: LeaveBalanceService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'Europe/Belgrade' })
  async handleDailyReminders() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      await this.email.sendExpiryReminders(t.id);
    }
  }

  @Cron('0 1 1 1 *', { timeZone: 'Europe/Belgrade' })
  async handleJanuaryEntitlements() {
    const users = await this.prisma.user.findMany({
      where: { tenantId: { not: null }, isActive: true, employmentDate: { not: null } },
      select: { id: true, tenantId: true },
    });
    for (const u of users) {
      if (u.tenantId) await this.balance.ensureEntitlements(u.tenantId, u.id);
    }
  }

  @Cron('0 1 1 7 *', { timeZone: 'Europe/Belgrade' })
  async handleJulyEntitlements() {
    await this.handleJanuaryEntitlements();
  }
}
