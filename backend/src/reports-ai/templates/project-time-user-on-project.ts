import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportTemplate, ReportTableResult } from './types';

export function projectTimeUserOnProjectTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'project_time_user_on_project',
    title: 'Utrošeno vreme korisnika na projektu',
    description: 'Utrošeno vreme za jednog korisnika na jednom projektu (opciono poslednjih N dana).',
    paramsSchema: { email: 'string', project: 'string', days: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const email = String(params.email ?? '').trim().toLowerCase();
      const projectName = String(params.project ?? '').trim();
      if (!email) throw new BadRequestException('Parametar email je obavezan.');
      if (!projectName) throw new BadRequestException('Parametar project je obavezan (naziv projekta).');

      const days = params.days != null ? Math.max(1, Number(params.days)) : 0;
      const since = new Date(ctx.now);
      if (days) since.setDate(since.getDate() - days);

      const user = await prisma.user.findFirst({
        where: { tenantId: ctx.tenantId, email },
        select: { id: true, email: true, displayName: true },
      });
      if (!user) throw new BadRequestException('Korisnik nije pronađen.');

      const project = await prisma.project.findFirst({
        where: { tenantId: ctx.tenantId, name: { equals: projectName, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (!project) throw new BadRequestException('Projekat nije pronađen.');

      const rowsRaw = await prisma.projectWorkOrder.findMany({
        where: {
          tenantId: ctx.tenantId,
          userId: user.id,
          projectId: project.id,
          ...(days ? { workDate: { gte: since } } : {}),
        },
        select: { workDate: true, title: true, description: true, hours: true },
        orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
        take: 200000,
      });

      const total = rowsRaw.reduce((acc, r) => acc + r.hours, 0);
      const rows = rowsRaw.map((r) => ({
        workDate: r.workDate.toISOString().slice(0, 10),
        title: r.title,
        description: r.description ?? '',
        hours: Number(r.hours.toFixed(2)),
      }));

      return {
        title: days
          ? `Utrošeno vreme: ${user.displayName || user.email} / ${project.name} (poslednjih ${days} dana)`
          : `Utrošeno vreme: ${user.displayName || user.email} / ${project.name}`,
        columns: [
          { key: 'workDate', label: 'Datum' },
          { key: 'title', label: 'Radni nalog' },
          { key: 'description', label: 'Opis' },
          { key: 'hours', label: 'Sati' },
        ],
        rows: [{ workDate: '', title: '__TOTAL__', description: '', hours: Number(total.toFixed(2)) }, ...rows],
        meta: { email, project: project.name, days: days || null },
      };
    },
  };
}

