import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PatchEmailSettingsDto } from './dto/email-settings.dto';
import { AuditLogService } from './audit-log.service';

export type EmailSettingsResponse = {
  emailFromAddress: string | null;
  emailFromName: string | null;
  emailProvider: 'GOOGLE' | 'M365' | null;
  passwordSet: boolean;
};

@Injectable()
export class SettingsEmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async get(tenantId: string): Promise<EmailSettingsResponse> {
    const s = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
    });
    if (!s) throw new NotFoundException('Tenant settings not found');
    return {
      emailFromAddress: s.emailFromAddress,
      emailFromName: s.emailFromName,
      emailProvider: (s.emailProvider as 'GOOGLE' | 'M365') ?? null,
      passwordSet: !!s.emailPassword,
    };
  }

  async patch(tenantId: string, actorUserId: string, dto: PatchEmailSettingsDto) {
    const data: Record<string, unknown> = {};
    if (dto.emailFromAddress !== undefined) data.emailFromAddress = dto.emailFromAddress;
    if (dto.emailFromName !== undefined) data.emailFromName = dto.emailFromName;
    if (dto.emailProvider !== undefined) data.emailProvider = dto.emailProvider;
    if (dto.emailPassword !== undefined && dto.emailPassword !== '') {
      data.emailPassword = dto.emailPassword;
    }
    await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...(data as object) },
      update: data as object,
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'UPDATE_EMAIL_SETTINGS',
      entityType: 'TenantSettings',
      entityId: tenantId,
      metadata: { changed: Object.keys(data).filter((k) => k !== 'emailPassword') },
    });
    return this.get(tenantId);
  }
}
