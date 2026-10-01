import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportTemplate, ReportTableResult } from './types';

export function projectTimeUserAllProjectsTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'project_time_user_all_projects',
    title: 'Utrošeno vreme korisnika na svim projektima',
    description: 'Ukupno vreme za jednog korisnika kroz sve projekte (opciono poslednjih N dana).',
    paramsSchema: { email: 'string', days: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const email = String(params.email ?? '').trim().toLowerCase();
      if (!email) throw new BadRequestException('Parametar email je obavezan.');
      const days = params.days != null ? Math.max(1, Number(params.days)) : 0;
      const since = new Date(ctx.now);
      if (days) since.setDate(since.getDate() - days);

      const user = await prisma.user.findFirst({
        where: { tenantId: ctx.tenantId, email },
        select: { id: true, email: true, displayName: true },
      });
      if (!user) throw new BadRequestException('Korisnik nije pronađen.');

      const workOrders = await prisma.projectWorkOrder.findMany({
        where: {
          tenantId: ctx.tenantId,
          userId: user.id,
          ...(days ? { workDate: { gte: since } } : {}),
        },
        select: { projectId: true, hours: true, project: { select: { name: true } } },
        take: 200000,
      });

      const totals = new Map<string, { projectId: string; projectName: string; hours: number }>();
      let total = 0;
      for (const w of workOrders) {
        total += w.hours;
        const prev = totals.get(w.projectId);
        if (prev) prev.hours += w.hours;
        else totals.set(w.projectId, { projectId: w.projectId, projectName: w.project.name, hours: w.hours });
      }

      const rows = Array.from(totals.values())
        .map((r) => ({ ...r, hours: Number(r.hours.toFixed(2)) }))
        .sort((a, b) => b.hours - a.hours);

      return {
        title: days
          ? `Utrošeno vreme: ${user.displayName || user.email} (poslednjih ${days} dana)`
          : `Utrošeno vreme: ${user.displayName || user.email}`,
        columns: [
          { key: 'projectName', label: 'Projekat' },
          { key: 'hours', label: 'Sati' },
          { key: 'projectId', label: 'Project ID' },
        ],
        rows: [
          { projectName: '__TOTAL__', hours: Number(total.toFixed(2)), projectId: '' },
          ...rows,
        ],
        meta: { email, days: days || null },
      };
    },
  };
}

