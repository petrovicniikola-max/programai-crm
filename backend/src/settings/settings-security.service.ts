import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PatchSecurityDto } from './dto/security.dto';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class SettingsSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async get(tenantId: string) {
    const s = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
    });
    if (!s) throw new NotFoundException('Tenant settings not found');
    return { jwtAccessTtlMinutes: s.jwtAccessTtlMinutes ?? 10080 };
  }

  async patch(tenantId: string, actorUserId: string, dto: PatchSecurityDto) {
    const data = dto.jwtAccessTtlMinutes !== undefined ? { jwtAccessTtlMinutes: dto.jwtAccessTtlMinutes } : {};
    await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'UPDATE_SECURITY',
      entityType: 'TenantSettings',
      entityId: tenantId,
      metadata: data,
    });
    return this.get(tenantId);
  }
}
