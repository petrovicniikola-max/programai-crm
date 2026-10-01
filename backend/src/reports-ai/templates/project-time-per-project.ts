import { PrismaService } from '../../prisma/prisma.service';
import { ReportTemplate, ReportTableResult } from './types';

export function projectTimePerProjectTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'project_time_per_project',
    title: 'Utrošeno vreme po projektu',
    description: 'Ukupno utrošeno vreme po projektu, sa opcijom ograničenja na poslednjih N dana.',
    paramsSchema: { days: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const days = params.days != null ? Math.max(1, Number(params.days)) : 0;
      const since = new Date(ctx.now);
      if (days) since.setDate(since.getDate() - days);

      const projects = await prisma.project.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true, name: true },
        orderBy: { createdAt: 'desc' },
      });

      const workOrders = await prisma.projectWorkOrder.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(days ? { workDate: { gte: since } } : {}),
        },
        select: { projectId: true, hours: true },
        take: 200000,
      });

      const totals = new Map<string, number>();
      for (const w of workOrders) {
        totals.set(w.projectId, (totals.get(w.projectId) ?? 0) + w.hours);
      }

      const rows = projects
        .map((p) => ({
          projectId: p.id,
          projectName: p.name,
          totalHours: Number((totals.get(p.id) ?? 0).toFixed(2)),
        }))
        .sort((a, b) => b.totalHours - a.totalHours);

      return {
        title: days ? `Utrošeno vreme po projektu (poslednjih ${days} dana)` : 'Utrošeno vreme po projektu',
        columns: [
          { key: 'projectName', label: 'Projekat' },
          { key: 'totalHours', label: 'Ukupno sati' },
          { key: 'projectId', label: 'Project ID' },
        ],
        rows,
        meta: { days: days || null },
      };
    },
  };
}

