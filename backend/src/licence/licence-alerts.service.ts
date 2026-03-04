import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../settings/audit-log.service';

const LICENCE_ALERTS_QUEUE = 'licence-alerts';

export interface LicenceAlertJobPayload {
  tenantId: string;
  licenceId: string;
  daysBefore: number;
  triggerDate: string;
  companyName: string;
  productName: string;
  validTo: string;
  recipientEmails: string[];
  fromName: string | null;
  fromAddress: string | null;
  emailSignature: string | null;
}

@Injectable()
export class LicenceAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    @InjectQueue(LICENCE_ALERTS_QUEUE) private readonly queue: Queue,
  ) {}

  async runScheduled(): Promise<{ enqueued: number; tenantsScanned: number }> {
    return this.runScan(undefined);
  }

  async runNow(actorUserId: string): Promise<{ enqueued: number; tenantsScanned: number }> {
    return this.runScan(actorUserId);
  }

  private async runScan(actorUserId: string | undefined): Promise<{ enqueued: number; tenantsScanned: number }> {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true },
    });
    let enqueued = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const tenant of tenants) {
      const settings = await this.prisma.tenantSettings.findUnique({
        where: { tenantId: tenant.id },
      });
      const daysBefore = (settings?.notificationsDaysBefore as number[] | null) ?? [30, 14, 7, 1];
      if (!Array.isArray(daysBefore) || daysBefore.length === 0) continue;

      const now = new Date();
      for (const d of daysBefore) {
        const start = new Date(now);
        start.setDate(start.getDate() + d);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);

        const licences = await this.prisma.licence.findMany({
          where: {
            tenantId: tenant.id,
            status: 'ACTIVE',
            validTo: { gte: start, lte: end },
          },
          include: { company: true },
        });

        for (const lic of licences) {
          const existing = await this.prisma.licenceNotificationLog.findUnique({
            where: {
              tenantId_licenceId_daysBefore_triggerDate: {
                tenantId: tenant.id,
                licenceId: lic.id,
                daysBefore: d,
                triggerDate: today,
              },
            },
          });
          if (existing) continue;

          const contacts = await this.prisma.contact.findMany({
            where: { companyId: lic.companyId, tenantId: tenant.id },
          });
          const recipientEmails = contacts.map((c) => c.email).filter((e): e is string => !!e?.trim());
          const fromName = settings?.emailFromName ?? null;
          const fromAddress = settings?.emailFromAddress ?? null;
          const emailSignature = settings?.emailSignature ?? null;

          await this.queue.add(
            'send',
            {
              tenantId: tenant.id,
              licenceId: lic.id,
              daysBefore: d,
              triggerDate: today.toISOString().slice(0, 10),
              companyName: lic.company?.name ?? 'Unknown',
              productName: lic.productName,
              validTo: lic.validTo.toISOString(),
              recipientEmails,
              fromName,
              fromAddress,
              emailSignature,
            } as LicenceAlertJobPayload,
            { jobId: `${tenant.id}-${lic.id}-${d}-${today.getTime()}` },
          );
          enqueued++;
        }
      }

      await this.markExpiredLicences(tenant.id);
    }

    if (actorUserId && tenants.length > 0) {
      await this.audit.log({
        tenantId: tenants[0].id,
        actorUserId,
        action: 'RUN_LICENCE_ALERTS',
        entityType: 'System',
        metadata: { enqueued, tenantsScanned: tenants.length },
      });
    }
    return { enqueued, tenantsScanned: tenants.length };
  }

  private async markExpiredLicences(tenantId: string) {
    const now = new Date();
    await this.prisma.licence.updateMany({
      where: { tenantId, status: 'ACTIVE', validTo: { lt: now } },
      data: { status: 'EXPIRED' },
    });
  }

  async getLogs(tenantId: string, limit: number, offset: number) {
    const [items, total] = await Promise.all([
      this.prisma.licenceNotificationLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { licence: { select: { productName: true, validTo: true } } },
      }),
      this.prisma.licenceNotificationLog.count({ where: { tenantId } }),
    ]);
    return { items, total, limit, offset };
  }
}
