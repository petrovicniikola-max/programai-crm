import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PatchNotificationsDto } from './dto/notifications.dto';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class SettingsNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async get(tenantId: string) {
    const s = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
    });
    if (!s) throw new NotFoundException('Tenant settings not found');
    return {
      emailFromName: s.emailFromName,
      emailFromAddress: s.emailFromAddress,
      notificationsDaysBefore: (s.notificationsDaysBefore as number[] | null) ?? [30, 14, 7, 1],
    };
  }

  async patch(tenantId: string, actorUserId: string, dto: PatchNotificationsDto) {
    const data: Record<string, unknown> = {};
    if (dto.emailFromName !== undefined) data.emailFromName = dto.emailFromName;
    if (dto.emailFromAddress !== undefined) data.emailFromAddress = dto.emailFromAddress;
    if (dto.notificationsDaysBefore !== undefined) data.notificationsDaysBefore = dto.notificationsDaysBefore;
    await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...(data as object) },
      update: data as object,
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'UPDATE_NOTIFICATIONS',
      entityType: 'TenantSettings',
      entityId: tenantId,
      metadata: { changed: Object.keys(data) },
    });
    return this.get(tenantId);
  }
}
