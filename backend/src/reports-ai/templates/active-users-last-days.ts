import { PrismaService } from '../../prisma/prisma.service';
import { ReportTemplate, ReportTableResult } from './types';

export function activeUsersLastDaysTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'active_users_last_days',
    title: 'Aktivni korisnici u poslednjih N dana',
    description:
      'Broj aktivnih korisnika na sistemu u poslednjih N dana (aktivnost = AUTH_LOGIN u audit logu).',
    paramsSchema: { days: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const days = Math.max(1, Number(params.days ?? 60));
      const since = new Date(ctx.now);
      since.setDate(since.getDate() - days);

      const rows = await prisma.auditLog.findMany({
        where: {
          tenantId: ctx.tenantId,
          action: 'AUTH_LOGIN',
          actorUserId: { not: null },
          createdAt: { gte: since },
        },
        select: { actorUserId: true },
        take: 10000,
      });
      const uniq = new Set(rows.map((r) => r.actorUserId!).filter(Boolean));
      return {
        title: `Aktivni korisnici (poslednjih ${days} dana)`,
        columns: [
          { key: 'metric', label: 'Metrička' },
          { key: 'value', label: 'Vrednost' },
        ],
        rows: [{ metric: 'Broj aktivnih korisnika', value: uniq.size }],
        meta: { days },
      };
    },
  };
}

