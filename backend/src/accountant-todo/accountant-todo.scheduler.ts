import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AccountantTodoEmailService } from './accountant-todo-email.service';
import { TodoTeamService } from './todo-team.service';
import { belgradeTodayParts } from './accountant-todo-date.utils';

@Injectable()
export class AccountantTodoScheduler {
  private readonly logger = new Logger(AccountantTodoScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: AccountantTodoEmailService,
    private readonly teams: TodoTeamService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'Europe/Belgrade' })
  async handleDailyReminders() {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    const now = new Date();
    const belgradeHour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Belgrade',
        hour: 'numeric',
        hour12: false,
      }).format(now),
    );
    const belgradeMinute = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Belgrade',
        minute: 'numeric',
      }).format(now),
    );

    for (const t of tenants) {
      try {
        const tenantSettings = await this.prisma.tenantAccountantTodoSettings.findUnique({
          where: { tenantId: t.id },
        });
        const defaultTime = tenantSettings?.reminderTime ?? '08:00';

        const teamRows = await this.teams.getActiveTeamsForDigest(t.id);
        if (!teamRows.length) continue;

        for (const team of teamRows) {
          const reminderTime = team.reminderTime ?? defaultTime;
          const [h, m] = reminderTime.split(':').map(Number);
          if (belgradeHour !== h || belgradeMinute !== m) continue;

          const result = await this.email.sendTeamDigest(t.id, team.id);
          if (result.sent) {
            this.logger.log(`Sent todo digest for team ${team.id} (tenant ${t.id})`);
          }
        }
      } catch (e) {
        this.logger.error(`Accountant todo digest failed for ${t.id}`, e);
      }
    }
  }
}
