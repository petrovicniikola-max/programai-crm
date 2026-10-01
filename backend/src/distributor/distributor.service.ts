import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function parseDistributorName(nameRaw: string): { mainName: string; subName: string | null } {
  const name = (nameRaw ?? '').trim();
  const idx = name.indexOf('/');
  if (idx === -1) return { mainName: name, subName: null };
  const mainName = name.slice(0, idx).trim();
  const subName = name.slice(idx + 1).trim();
  return { mainName, subName: subName || null };
}

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

  async findMainDistributors(tenantId: string, search?: string) {
    const q = search?.trim();
    const mains = await this.prisma.distributor.findMany({
      where: {
        tenantId,
        NOT: { name: { contains: '/' } },
        ...(q && q.length >= 2 ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
      take: q ? 50 : undefined,
      include: { _count: { select: { devices: true } } },
    });

    // include sub-distributor devices in the main distributor "totalDevices"
    const mainNames = mains.map((d) => d.name);
    if (mainNames.length === 0) return mains.map((d) => ({ ...d, totalDevices: d._count?.devices ?? 0 }));

    const subs = await this.prisma.distributor.findMany({
      where: {
        tenantId,
        OR: mainNames.map((n) => ({ name: { startsWith: `${n}/` } })),
      },
      include: { _count: { select: { devices: true } } },
    });

    const totalsByMain = new Map<string, number>();
    for (const m of mains) totalsByMain.set(m.name, m._count?.devices ?? 0);
    for (const s of subs) {
      const parsed = parseDistributorName(s.name);
      if (!parsed.mainName) continue;
      if (!totalsByMain.has(parsed.mainName)) continue;
      totalsByMain.set(parsed.mainName, (totalsByMain.get(parsed.mainName) ?? 0) + (s._count?.devices ?? 0));
    }

    return mains.map((d) => ({
      ...d,
      totalDevices: totalsByMain.get(d.name) ?? (d._count?.devices ?? 0),
    }));
  }

  async findSubDistributors(tenantId: string, search?: string) {
    const q = search?.trim();
    const subs = await this.prisma.distributor.findMany({
      where: {
        tenantId,
        name: { contains: '/' },
        ...(q && q.length >= 2 ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
      take: q ? 50 : undefined,
      include: { _count: { select: { devices: true } } },
    });

    return subs.map((d) => {
      const parsed = parseDistributorName(d.name);
      return { ...d, mainName: parsed.mainName, subName: parsed.subName };
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

  async resolveDistributorIdsForDeviceFilter(
    tenantId: string,
    distributorId: string,
  ): Promise<{ distributorIds: string[]; isMain: boolean; mainName: string | null }> {
    const base = await this.prisma.distributor.findFirst({
      where: { id: distributorId, tenantId },
    });
    if (!base) return { distributorIds: [distributorId], isMain: false, mainName: null };
    const parsed = parseDistributorName(base.name);
    const isMain = parsed.subName == null && !!parsed.mainName;
    if (!isMain) return { distributorIds: [distributorId], isMain: false, mainName: parsed.mainName };

    const subs = await this.prisma.distributor.findMany({
      where: { tenantId, name: { startsWith: `${base.name}/` } },
      select: { id: true },
    });
    return { distributorIds: [base.id, ...subs.map((s) => s.id)], isMain: true, mainName: base.name };
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
