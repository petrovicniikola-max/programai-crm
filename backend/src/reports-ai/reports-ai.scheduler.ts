import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsAiService } from './reports-ai.service';

@Injectable()
export class ReportsAiScheduler {
  private readonly logger = new Logger(ReportsAiScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsAiService: ReportsAiService,
  ) {}

  @Cron('*/5 * * * *')
  async tick() {
    const now = new Date();
    const due = await this.prisma.aiReportSchedule.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
      take: 20,
    });
    for (const s of due) {
      try {
        await this.reportsAiService.runScheduledOnce(s.tenantId, s.id);
      } catch (e) {
        this.logger.warn(
          `Schedule ${s.id} failed: ${e instanceof Error ? e.message : String(e)}`,
        );
        // best-effort; nextRunAt updated in runScheduledOnce on success
      }
    }
  }
}

