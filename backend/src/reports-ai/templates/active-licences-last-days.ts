import { PrismaService } from '../../prisma/prisma.service';
import { ReportTemplate, ReportTableResult } from './types';

export function activeLicencesLastDaysTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'active_licences_last_days',
    title: 'Aktivne licence u poslednjih N dana',
    description:
      'Broj aktivnih licenci kreiranih u poslednjih N dana (status=ACTIVE, createdAt>=now-N).',
    paramsSchema: { days: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const days = Math.max(1, Number(params.days ?? 30));
      const since = new Date(ctx.now);
      since.setDate(since.getDate() - days);

      const count = await prisma.licence.count({
        where: {
          tenantId: ctx.tenantId,
          status: 'ACTIVE',
          createdAt: { gte: since },
        },
      });

      return {
        title: `Aktivne licence (poslednjih ${days} dana)`,
        columns: [
          { key: 'metric', label: 'Metrička' },
          { key: 'value', label: 'Vrednost' },
        ],
        rows: [{ metric: 'Broj aktivnih licenci', value: count }],
        meta: { days },
      };
    },
  };
}

