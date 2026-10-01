import { PrismaService } from '../../prisma/prisma.service';
import { daysSince } from '../report-date-utils';
import { ReportTemplate, ReportTableResult } from './types';

export function companiesNoTicketsInDaysTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'companies_no_tickets_in_days',
    title: 'Kompanije bez tiketa',
    description: 'Kompanije koje nemaju nijedan tiket u poslednjih N dana.',
    paramsSchema: { days: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const days = Math.max(1, Number(params.days ?? 90));
      const since = daysSince(ctx.now, days);

      const [companies, recentTickets] = await Promise.all([
        prisma.company.findMany({
          where: { tenantId: ctx.tenantId },
          select: { id: true, name: true, city: true },
          take: 20000,
        }),
        prisma.ticket.findMany({
          where: { tenantId: ctx.tenantId, createdAt: { gte: since }, companyId: { not: null } },
          select: { companyId: true },
          take: 100000,
        }),
      ]);

      const activeCompanyIds = new Set(
        recentTickets.map((t) => t.companyId).filter((id): id is string => !!id),
      );

      const rows = companies
        .filter((c) => !activeCompanyIds.has(c.id))
        .map((c) => ({
          companyName: c.name,
          city: c.city ?? '',
          daysWithoutTicket: days,
        }))
        .sort((a, b) => a.companyName.localeCompare(b.companyName, 'sr'));

      return {
        title: `Kompanije bez tiketa u poslednjih ${days} dana`,
        columns: [
          { key: 'companyName', label: 'Kompanija' },
          { key: 'city', label: 'Grad' },
          { key: 'daysWithoutTicket', label: 'Period (dana)' },
        ],
        rows,
        meta: { days, rowCount: rows.length },
      };
    },
  };
}

export function topCompaniesByActiveDevicesTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'top_companies_by_active_devices',
    title: 'Top kompanije po uređajima',
    description: 'Kompanije sa najvećim brojem aktivnih uređaja.',
    paramsSchema: { limit: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const limit = Math.min(100, Math.max(1, Number(params.limit ?? 20)));

      const grouped = await prisma.device.groupBy({
        by: ['companyId'],
        where: { tenantId: ctx.tenantId, status: 'ACTIVE', companyId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: limit,
      });

      const companyIds = grouped
        .map((g) => g.companyId)
        .filter((id): id is string => typeof id === 'string');
      const companies = companyIds.length
        ? await prisma.company.findMany({
            where: { tenantId: ctx.tenantId, id: { in: companyIds } },
            select: { id: true, name: true, city: true },
          })
        : [];
      const companyById = new Map(companies.map((c) => [c.id, c]));

      const rows = grouped.map((g, idx) => {
        const c = g.companyId ? companyById.get(g.companyId) : undefined;
        return {
          rank: idx + 1,
          companyName: c?.name ?? '(nepoznato)',
          city: c?.city ?? '',
          activeDevices: g._count.id,
        };
      });

      return {
        title: `Top ${limit} kompanija po aktivnim uređajima`,
        columns: [
          { key: 'rank', label: '#' },
          { key: 'companyName', label: 'Kompanija' },
          { key: 'city', label: 'Grad' },
          { key: 'activeDevices', label: 'Aktivni uređaji' },
        ],
        rows,
        meta: { limit, rowCount: rows.length },
      };
    },
  };
}
