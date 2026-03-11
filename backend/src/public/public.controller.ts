import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Controller('public')
export class PublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get('branding')
  async getBranding(@Query('tenantSlug') tenantSlug?: string) {
    const defaultBranding = { brandName: 'CRM ESTUAR', primaryColour: null, logoUrl: null };
    try {
      const slug = tenantSlug?.trim() || this.config.get<string>('DEFAULT_TENANT_SLUG', 'demo');
      const tenant = await this.prisma.tenant.findFirst({
        where: { slug },
      });
      if (!tenant) return defaultBranding;
      const settings = await this.prisma.tenantSettings.findUnique({
        where: { tenantId: tenant.id },
      });
      return {
        brandName: settings?.brandName ?? tenant.name,
        primaryColour: settings?.primaryColour ?? null,
        logoUrl: settings?.logoUrl ?? null,
      };
    } catch {
      return defaultBranding;
    }
  }
}

