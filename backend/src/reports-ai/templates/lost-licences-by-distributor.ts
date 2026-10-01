import { PrismaService } from '../../prisma/prisma.service';
import { calendarDaysForReportHours, expiredInLastDays } from '../report-date-utils';
import { ReportTemplate, ReportTableResult } from './types';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function lostLicencesByDistributorTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'lost_licences_by_distributor',
    title: 'Istekle licence po distributeru',
    description:
      'Licence sa statusom EXPIRED čiji datum isteka (validTo) pada u zadat broj kalendarskih dana unazad od današnjeg dana.',
    paramsSchema: { days: 'number', hours: 'number', includeDetails: 'boolean' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const days = Math.max(
        1,
        Number(
          params.days ??
            (params.hours != null ? calendarDaysForReportHours(Number(params.hours)) : 3),
        ),
      );
      const includeDetails = params.includeDetails !== false;
      const { from, to, calendarDays } = expiredInLastDays(ctx.now, days);

      const licences = await prisma.licence.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: 'EXPIRED',
          validTo: { gte: from, lte: to },
        },
        select: {
          productName: true,
          status: true,
          validTo: true,
          company: { select: { name: true } },
          device: {
            select: {
              name: true,
              serialNo: true,
              distributor: { select: { name: true } },
            },
          },
        },
        orderBy: { validTo: 'desc' },
        take: 10000,
      });

      const counts = new Map<string, number>();
      for (const l of licences) {
        const name = l.device?.distributor?.name ?? '(bez distributera)';
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }

      const summaryRows = Array.from(counts.entries())
        .map(([distributorName, lostCount]) => ({ distributorName, lostCount }))
        .sort((a, b) => b.lostCount - a.lostCount);

      const total = licences.length;
      const periodLabel = `${formatDate(from)} – ${formatDate(to)}`;

      const rows: Record<string, string | number | null>[] = [
        { distributorName: '__UKUPNO__', lostCount: total },
        ...summaryRows.map((r) => ({
          distributorName: r.distributorName,
          lostCount: r.lostCount,
          companyName: null,
          productName: null,
          deviceSerial: null,
          validTo: null,
        })),
      ];

      if (includeDetails) {
        for (const l of licences) {
          rows.push({
            distributorName: l.device?.distributor?.name ?? '(bez distributera)',
            lostCount: null,
            companyName: l.company.name,
            productName: l.productName,
            deviceSerial: l.device?.name ?? l.device?.serialNo ?? '',
            validTo: formatDate(l.validTo),
          });
        }
      }

      const columns = includeDetails
        ? [
            { key: 'distributorName', label: 'Distributer' },
            { key: 'lostCount', label: 'Broj isteklih' },
            { key: 'companyName', label: 'Kompanija' },
            { key: 'productName', label: 'Proizvod' },
            { key: 'deviceSerial', label: 'Uređaj' },
            { key: 'validTo', label: 'Datum isteka' },
          ]
        : [
            { key: 'distributorName', label: 'Distributer' },
            { key: 'lostCount', label: 'Broj isteklih' },
          ];

      return {
        title: `Istekle licence po distributeru (${periodLabel})`,
        columns,
        rows: includeDetails
          ? rows
          : [{ distributorName: '__UKUPNO__', lostCount: total }, ...summaryRows],
        meta: {
          days,
          calendarDays,
          validFrom: formatDate(from),
          validTo: formatDate(to),
          total,
          distributorCount: summaryRows.length,
          includeDetails,
        },
      };
    },
  };
}
