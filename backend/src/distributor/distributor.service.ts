import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DistributorService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string, search?: string) {
    const q = search?.trim();
    return this.prisma.distributor.findMany({
      where: {
        tenantId,
        ...(q && q.length >= 2 ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
      take: q ? 50 : undefined,
      include: {
        _count: { select: { devices: true } },
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const row = await this.prisma.distributor.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { devices: true } },
      },
    });
    if (!row) throw new NotFoundException('Distributor not found');
    return row;
  }

  /** Find or create distributor by exact display name (trimmed). */
  async findOrCreateByName(tenantId: string, name: string): Promise<{ id: string; created: boolean }> {
    const trimmed = name.trim();
    const existing = await this.prisma.distributor.findUnique({
      where: { tenantId_name: { tenantId, name: trimmed } },
    });
    if (existing) return { id: existing.id, created: false };

    const count = await this.prisma.distributor.count({ where: { tenantId } });
    const created = await this.prisma.distributor.create({
      data: { tenantId, name: trimmed },
    });
    void count;
    return { id: created.id, created: true };
  }
}
