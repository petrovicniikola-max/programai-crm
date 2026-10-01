import { PrismaService } from '../../prisma/prisma.service';
import { resolvePeriod } from '../report-date-utils';
import { ReportTemplate, ReportTableResult } from './types';

export function projectTimeMonthlyByUserAndProjectTemplate(
  prisma: PrismaService,
): ReportTemplate {
  return {
    key: 'project_time_monthly_by_user_and_project',
    title: 'Evidencija rada – sati po korisniku i projektu (period)',
    description:
      'Utrošeni sati po korisniku i projektu za mesec ili celu godinu (godina + opcioni mesec).',
    paramsSchema: { year: 'number', month: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const period = resolvePeriod(ctx.now, {
        year: params.year != null ? Number(params.year) : null,
        month: params.month != null ? Number(params.month) : null,
      });
      const { from, to, label, year, month } = period;

      const workOrders = await prisma.projectWorkOrder.findMany({
        where: {
          tenantId: ctx.tenantId,
          workDate: { gte: from, lte: to },
        },
        select: {
          hours: true,
          userId: true,
          projectId: true,
          user: { select: { email: true, displayName: true } },
          project: { select: { name: true } },
        },
        take: 200000,
      });

      const totals = new Map<
        string,
        {
          userEmail: string;
          userName: string;
          projectName: string;
          hours: number;
        }
      >();

      for (const w of workOrders) {
        const key = `${w.userId}::${w.projectId}`;
        const prev = totals.get(key);
        if (prev) {
          prev.hours += w.hours;
        } else {
          totals.set(key, {
            userEmail: w.user.email,
            userName: w.user.displayName?.trim() || w.user.email,
            projectName: w.project.name,
            hours: w.hours,
          });
        }
      }

      const rows = Array.from(totals.values())
        .map((r) => ({
          userName: r.userName,
          userEmail: r.userEmail,
          projectName: r.projectName,
          hours: Number(r.hours.toFixed(2)),
          period: label,
        }))
        .sort((a, b) => {
          const byUser = a.userName.localeCompare(b.userName, 'sr');
          if (byUser !== 0) return byUser;
          return a.projectName.localeCompare(b.projectName, 'sr');
        });

      const grandTotal = Number(
        rows.reduce((sum, r) => sum + Number(r.hours), 0).toFixed(2),
      );

      return {
        title: `Evidencija rada – ${label}`,
        columns: [
          { key: 'userName', label: 'Korisnik' },
          { key: 'userEmail', label: 'Email' },
          { key: 'projectName', label: 'Projekat' },
          { key: 'hours', label: 'Sati' },
          { key: 'period', label: 'Period' },
        ],
        rows: [
          {
            userName: '__UKUPNO__',
            userEmail: '',
            projectName: '',
            hours: grandTotal,
            period: label,
          },
          ...rows,
        ],
        meta: {
          year,
          month: month ?? null,
          periodKind: period.kind,
          periodLabel: label,
          rowCount: rows.length,
        },
      };
    },
  };
}
