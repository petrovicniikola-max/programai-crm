import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Used when Redis is not available (REDIS_ENABLED !== 'true').
 * runNow/runScheduled return zero enqueued; getLogs returns empty.
 */
@Injectable()
export class LicenceAlertsStubService {
  constructor(private readonly prisma: PrismaService) {}

  async runScheduled(): Promise<{ enqueued: number; tenantsScanned: number }> {
    return { enqueued: 0, tenantsScanned: 0 };
  }

  async runNow(_actorUserId: string): Promise<{ enqueued: number; tenantsScanned: number }> {
    return { enqueued: 0, tenantsScanned: 0 };
  }

  async getLogs(tenantId: string, limit: number, offset: number) {
    const total = await this.prisma.licenceNotificationLog.count({ where: { tenantId } });
    return { items: [], total, limit, offset };
  }
}
