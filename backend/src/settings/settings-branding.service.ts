import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PatchBrandingDto } from './dto/branding.dto';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class SettingsBrandingService {
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
      logoUrl: s.logoUrl,
      brandName: s.brandName,
      primaryColour: s.primaryColour,
      emailSignature: s.emailSignature,
    };
  }

  async patch(tenantId: string, actorUserId: string, dto: PatchBrandingDto) {
    const data = {
      ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
      ...(dto.brandName !== undefined && { brandName: dto.brandName }),
      ...(dto.primaryColour !== undefined && { primaryColour: dto.primaryColour }),
      ...(dto.emailSignature !== undefined && { emailSignature: dto.emailSignature }),
    };
    const updated = await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'UPDATE_BRANDING',
      entityType: 'TenantSettings',
      entityId: tenantId,
      metadata: { changed: Object.keys(data) },
    });
    return { logoUrl: updated.logoUrl, brandName: updated.brandName, primaryColour: updated.primaryColour, emailSignature: updated.emailSignature };
  }
}
