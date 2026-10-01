import { PrismaService } from '../../prisma/prisma.service';
import { daysSince } from '../report-date-utils';
import { ReportTemplate, ReportTableResult } from './types';

export function licencesExpiringSoonByCompanyTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'licences_expiring_soon_by_company',
    title: 'Licence koje ističu uskoro',
    description: 'Aktivne licence čiji validTo pada u narednih N dana, grupisano po kompaniji.',
    paramsSchema: { days: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const days = Math.max(1, Number(params.days ?? 30));
      const until = new Date(ctx.now);
      until.setDate(until.getDate() + days);
      until.setHours(23, 59, 59, 999);

      const licences = await prisma.licence.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: 'ACTIVE',
          validTo: { gte: ctx.now, lte: until },
        },
        select: {
          productName: true,
          validTo: true,
          company: { select: { name: true } },
          device: { select: { name: true, serialNo: true } },
        },
        orderBy: { validTo: 'asc' },
        take: 10000,
      });

      const rows = licences.map((l) => ({
        companyName: l.company.name,
        productName: l.productName,
        deviceName: l.device?.name ?? l.device?.serialNo ?? '',
        validTo: l.validTo.toISOString().slice(0, 10),
        daysLeft: Math.max(
          0,
          Math.ceil((l.validTo.getTime() - ctx.now.getTime()) / 86400000),
        ),
      }));

      return {
        title: `Licence koje ističu u narednih ${days} dana`,
        columns: [
          { key: 'companyName', label: 'Kompanija' },
          { key: 'productName', label: 'Proizvod' },
          { key: 'deviceName', label: 'Uređaj' },
          { key: 'validTo', label: 'Važi do' },
          { key: 'daysLeft', label: 'Dana do isteka' },
        ],
        rows,
        meta: { days, rowCount: rows.length },
      };
    },
  };
}

export function activeDevicesWithoutLicenceTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'active_devices_without_licence',
    title: 'Aktivni uređaji bez licence',
    description: 'Uređaji u statusu ACTIVE koji nemaju nijednu aktivnu licencu.',
    paramsSchema: {},
    run: async (ctx): Promise<ReportTableResult> => {
      const devices = await prisma.device.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: 'ACTIVE',
          licences: { none: { status: 'ACTIVE' } },
        },
        select: {
          name: true,
          model: true,
          serialNo: true,
          company: { select: { name: true } },
          distributor: { select: { name: true } },
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      });

      const rows = devices.map((d) => ({
        deviceName: d.name ?? d.serialNo ?? '',
        model: d.model ?? '',
        serialNo: d.serialNo ?? '',
        companyName: d.company?.name ?? '',
        distributorName: d.distributor?.name ?? '',
        createdAt: d.createdAt.toISOString().slice(0, 10),
      }));

      return {
        title: 'Aktivni uređaji bez aktivne licence',
        columns: [
          { key: 'deviceName', label: 'Uređaj' },
          { key: 'model', label: 'Model' },
          { key: 'serialNo', label: 'Serijski broj' },
          { key: 'companyName', label: 'Kompanija' },
          { key: 'distributorName', label: 'Distributer' },
          { key: 'createdAt', label: 'Kreiran' },
        ],
        rows,
        meta: { rowCount: rows.length },
      };
    },
  };
}

export function newDevicesByDistributorTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'new_devices_by_distributor',
    title: 'Novi uređaji po distributeru',
    description: 'Broj novo registrovanih uređaja u poslednjih N dana, po distributeru.',
    paramsSchema: { days: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const days = Math.max(1, Number(params.days ?? 30));
      const since = daysSince(ctx.now, days);

      const devices = await prisma.device.findMany({
        where: { tenantId: ctx.tenantId, createdAt: { gte: since } },
        select: { distributor: { select: { name: true } } },
        take: 50000,
      });

      const counts = new Map<string, number>();
      for (const d of devices) {
        const name = d.distributor?.name ?? '(bez distributera)';
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }

      const rows = Array.from(counts.entries())
        .map(([distributorName, count]) => ({ distributorName, count }))
        .sort((a, b) => b.count - a.count);

      const total = rows.reduce((s, r) => s + r.count, 0);

      return {
        title: `Novi uređaji po distributeru (poslednjih ${days} dana)`,
        columns: [
          { key: 'distributorName', label: 'Distributer' },
          { key: 'count', label: 'Broj uređaja' },
        ],
        rows: [{ distributorName: '__UKUPNO__', count: total }, ...rows],
        meta: { days, rowCount: rows.length },
      };
    },
  };
}
