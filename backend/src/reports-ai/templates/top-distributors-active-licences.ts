import { PrismaService } from '../../prisma/prisma.service';
import { ReportTemplate, ReportTableResult } from './types';

export function topDistributorsActiveLicencesTemplate(
  prisma: PrismaService,
): ReportTemplate {
  return {
    key: 'top_distributors_active_licences',
    title: 'Top distributeri po aktivnim licencama (poslednjih N dana)',
    description:
      'Prikazuje distributere sa najviše aktivnih licenci kreiranih u poslednjih N dana.',
    paramsSchema: { days: 'number', limit: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const days = Number(params.days ?? 30);
      const limit = Math.min(50, Math.max(1, Number(params.limit ?? 10)));
      const since = new Date(ctx.now);
      since.setDate(since.getDate() - Math.max(1, days));

      // Use SQL for aggregation across relations (Licence -> Device -> Distributor)
      const rows = (await prisma.$queryRaw<
        { distributorId: string | null; distributorName: string | null; activeLicences: number }[]
      >`
        SELECT
          d."id" as "distributorId",
          d."name" as "distributorName",
          COUNT(l."id")::int as "activeLicences"
        FROM "Licence" l
        LEFT JOIN "Device" dev ON dev."id" = l."deviceId"
        LEFT JOIN "Distributor" d ON d."id" = dev."distributorId"
        WHERE l."tenantId" = ${ctx.tenantId}
          AND l."status" = 'ACTIVE'
          AND l."createdAt" >= ${since}
        GROUP BY d."id", d."name"
        ORDER BY COUNT(l."id") DESC
        LIMIT ${limit};
      `) as any;

      return {
        title: `Top distributeri: aktivne licence (poslednjih ${days} dana)`,
        columns: [
          { key: 'distributorName', label: 'Distributer' },
          { key: 'activeLicences', label: 'Aktivne licence' },
        ],
        rows: rows.map((r: any) => ({
          distributorName: r.distributorName ?? '—',
          activeLicences: Number(r.activeLicences ?? 0),
        })),
        meta: { days, limit },
      };
    },
  };
}

