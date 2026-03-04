import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(tenantId: string) {
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
    });
    if (!settings) throw new NotFoundException('Tenant settings not found');
    return settings;
  }

  async updateSettings(tenantId: string, data: Record<string, unknown> = {}) {
    return this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, data: data as object },
      update: { data: data as object },
    });
  }
}
