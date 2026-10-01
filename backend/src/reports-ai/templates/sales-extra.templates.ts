import { PrismaService } from '../../prisma/prisma.service';
import { companyMatchKey } from '../report-helpers';
import { daysSince } from '../report-date-utils';
import { ReportTemplate, ReportTableResult } from './types';

export function salesDirectoryWithoutCompanyMatchTemplate(
  prisma: PrismaService,
): ReportTemplate {
  return {
    key: 'sales_directory_without_company_match',
    title: 'Sales direktorijum – redovi bez kompanije',
    description:
      'Redovi iz sales direktorijuma koji nemaju odgovarajuću kompaniju u sistemu (PIB/MB).',
    paramsSchema: { days: 'number', limit: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const days = Math.max(0, Number(params.days ?? 30));
      const limit = Math.min(5000, Math.max(1, Number(params.limit ?? 2000)));
      const since = days ? daysSince(ctx.now, days) : undefined;

      const [sourceRows, companies] = await Promise.all([
        prisma.salesDirectoryRow.findMany({
          where: {
            tenantId: ctx.tenantId,
            ...(since ? { createdAt: { gte: since } } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            companyName: true,
            pib: true,
            mb: true,
            email: true,
            city: true,
            createdAt: true,
          },
        }),
        prisma.company.findMany({
          where: { tenantId: ctx.tenantId },
          select: { pib: true, mb: true },
          take: 20000,
        }),
      ]);

      const companyKeys = new Set<string>();
      for (const c of companies) {
        const k = companyMatchKey(c.pib, c.mb);
        if (k) companyKeys.add(k);
      }

      const rows = sourceRows
        .filter((r) => {
          const k = companyMatchKey(r.pib, r.mb);
          return !k || !companyKeys.has(k);
        })
        .map((r) => ({
          companyName: r.companyName ?? '',
          pib: r.pib ?? '',
          mb: r.mb ?? '',
          email: r.email ?? '',
          city: r.city ?? '',
          createdAt: r.createdAt.toISOString().slice(0, 10),
          matched: 'NE',
        }));

      return {
        title: days
          ? `Sales import bez kompanije (poslednjih ${days} dana)`
          : 'Sales import redovi bez povezane kompanije',
        columns: [
          { key: 'companyName', label: 'Naziv' },
          { key: 'pib', label: 'PIB' },
          { key: 'mb', label: 'MB' },
          { key: 'email', label: 'Email' },
          { key: 'city', label: 'Grad' },
          { key: 'createdAt', label: 'Uvezen' },
          { key: 'matched', label: 'Match' },
        ],
        rows,
        meta: { days: days || null, rowCount: rows.length, limit },
      };
    },
  };
}

export function salesDirectoryWithoutEmailTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'sales_directory_without_email',
    title: 'Sales direktorijum – bez emaila',
    description: 'Redovi iz sales direktorijuma bez email adrese.',
    paramsSchema: { limit: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const limit = Math.min(5000, Math.max(1, Number(params.limit ?? 2000)));

      const rows = await prisma.salesDirectoryRow.findMany({
        where: {
          tenantId: ctx.tenantId,
          OR: [{ email: null }, { email: '' }],
        },
        orderBy: { companyName: 'asc' },
        take: limit,
        select: {
          companyName: true,
          pib: true,
          mb: true,
          city: true,
          phone: true,
        },
      });

      return {
        title: 'Kompanije u sales direktorijumu bez email adrese',
        columns: [
          { key: 'companyName', label: 'Naziv' },
          { key: 'pib', label: 'PIB' },
          { key: 'mb', label: 'MB' },
          { key: 'city', label: 'Grad' },
          { key: 'phone', label: 'Telefon' },
        ],
        rows: rows.map((r) => ({
          companyName: r.companyName ?? '',
          pib: r.pib ?? '',
          mb: r.mb ?? '',
          city: r.city ?? '',
          phone: r.phone ?? '',
        })),
        meta: { rowCount: rows.length, limit },
      };
    },
  };
}
