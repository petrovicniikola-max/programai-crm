import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class SettingsUiTextsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async get(tenantId: string): Promise<Record<string, string>> {
    const s = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { uiTexts: true },
    });
    const raw = s?.uiTexts as unknown;
    if (!raw || typeof raw !== 'object') return {};
    if (Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  }

  async patch(
    tenantId: string,
    actorUserId: string,
    texts: Record<string, string>,
  ): Promise<Record<string, string>> {
    const updated = await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, uiTexts: texts as any },
      update: { uiTexts: texts as any },
      select: { uiTexts: true },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'UPDATE_UI_TEXTS',
      entityType: 'TenantSettings',
      entityId: tenantId,
      metadata: { keys: Object.keys(texts).slice(0, 200), count: Object.keys(texts).length },
    });
    const raw = updated.uiTexts as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return raw as Record<string, string>;
  }
}

