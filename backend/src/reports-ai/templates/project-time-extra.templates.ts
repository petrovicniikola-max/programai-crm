import { PrismaService } from '../../prisma/prisma.service';
import { findProjectByName } from '../report-helpers';
import { daysSince, quarterRange, resolvePeriod } from '../report-date-utils';
import { ReportTemplate, ReportTableResult } from './types';

function aggregateUserProjectHours(
  workOrders: {
    hours: number;
    userId: string;
    projectId: string;
    user: { email: string; displayName: string | null };
    project: { name: string };
  }[],
  periodLabel: string,
) {
  const totals = new Map<
    string,
    { userEmail: string; userName: string; projectName: string; hours: number }
  >();
  for (const w of workOrders) {
    const key = `${w.userId}::${w.projectId}`;
    const prev = totals.get(key);
    if (prev) prev.hours += w.hours;
    else {
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
      period: periodLabel,
    }))
    .sort((a, b) => {
      const byUser = a.userName.localeCompare(b.userName, 'sr');
      if (byUser !== 0) return byUser;
      return a.projectName.localeCompare(b.projectName, 'sr');
    });
  const grandTotal = Number(rows.reduce((sum, r) => sum + r.hours, 0).toFixed(2));
  return { rows, grandTotal };
}

export function projectTimeQuarterlyByUserAndProjectTemplate(
  prisma: PrismaService,
): ReportTemplate {
  return {
    key: 'project_time_quarterly_by_user_and_project',
    title: 'Evidencija rada – sati po korisniku i projektu (kvartalno)',
    description: 'Kvartalni izveštaj utrošenih sati po korisniku i projektu.',
    paramsSchema: { year: 'number', quarter: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const { from, to, label, year, quarter } = quarterRange(
        ctx.now,
        params.year != null ? Number(params.year) : undefined,
        params.quarter != null ? Number(params.quarter) : undefined,
      );
      const workOrders = await prisma.projectWorkOrder.findMany({
        where: { tenantId: ctx.tenantId, workDate: { gte: from, lte: to } },
        select: {
          hours: true,
          userId: true,
          projectId: true,
          user: { select: { email: true, displayName: true } },
          project: { select: { name: true } },
        },
        take: 200000,
      });
      const { rows, grandTotal } = aggregateUserProjectHours(workOrders, label);
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
          { userName: '__UKUPNO__', userEmail: '', projectName: '', hours: grandTotal, period: label },
          ...rows,
        ],
        meta: { year, quarter, periodLabel: label, rowCount: rows.length },
      };
    },
  };
}

export function projectTimeProjectMonthlyByUserTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'project_time_project_monthly_by_user',
    title: 'Utrošeno vreme na projektu – po korisniku (mesečno)',
    description: 'Za jedan projekat prikazuje utrošene sate po korisniku u izabranom mesecu.',
    paramsSchema: { project: 'string', year: 'number', month: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const projectName = String(params.project ?? '').trim();
      if (!projectName) throw new Error('Naziv projekta je obavezan.');
      const project = await findProjectByName(prisma, ctx.tenantId, projectName);
      if (!project) throw new Error(`Projekat nije pronađen: ${projectName}`);

      const period = resolvePeriod(ctx.now, {
        year: params.year != null ? Number(params.year) : null,
        month: params.month != null ? Number(params.month) : null,
      });
      const { from, to, label, year, month } = {
        from: period.from,
        to: period.to,
        label: period.label,
        year: period.year,
        month: period.month ?? ctx.now.getMonth() + 1,
      };

      const workOrders = await prisma.projectWorkOrder.findMany({
        where: {
          tenantId: ctx.tenantId,
          projectId: project.id,
          workDate: { gte: from, lte: to },
        },
        select: {
          hours: true,
          userId: true,
          projectId: true,
          user: { select: { email: true, displayName: true } },
          project: { select: { name: true } },
        },
        take: 100000,
      });

      const byUser = new Map<string, { userName: string; userEmail: string; hours: number }>();
      for (const w of workOrders) {
        const prev = byUser.get(w.userId);
        if (prev) prev.hours += w.hours;
        else {
          byUser.set(w.userId, {
            userName: w.user.displayName?.trim() || w.user.email,
            userEmail: w.user.email,
            hours: w.hours,
          });
        }
      }

      const rows = Array.from(byUser.values())
        .map((r) => ({
          projectName: project.name,
          userName: r.userName,
          userEmail: r.userEmail,
          hours: Number(r.hours.toFixed(2)),
          month: label,
        }))
        .sort((a, b) => a.userName.localeCompare(b.userName, 'sr'));

      const total = Number(rows.reduce((s, r) => s + r.hours, 0).toFixed(2));

      return {
        title: `${project.name} – sati po korisniku (${label})`,
        columns: [
          { key: 'projectName', label: 'Projekat' },
          { key: 'userName', label: 'Korisnik' },
          { key: 'userEmail', label: 'Email' },
          { key: 'hours', label: 'Sati' },
          { key: 'month', label: 'Mesec' },
        ],
        rows: [
          { projectName: project.name, userName: '__UKUPNO__', userEmail: '', hours: total, month: label },
          ...rows,
        ],
        meta: { projectId: project.id, year, month, monthLabel: label },
      };
    },
  };
}

export function projectTimeMissingEntriesTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'project_time_missing_entries',
    title: 'Korisnici bez evidencije rada',
    description:
      'Korisnici dodeljeni projektima koji nisu uneli nijedan radni nalog u izabranom mesecu.',
    paramsSchema: { year: 'number', month: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const period = resolvePeriod(ctx.now, {
        year: params.year != null ? Number(params.year) : null,
        month: params.month != null ? Number(params.month) : null,
      });
      const { from, to, label, year, month } = {
        from: period.from,
        to: period.to,
        label: period.label,
        year: period.year,
        month: period.month ?? ctx.now.getMonth() + 1,
      };

      const [assignments, workOrders] = await Promise.all([
        prisma.projectAssignment.findMany({
          where: { tenantId: ctx.tenantId },
          select: {
            userId: true,
            projectId: true,
            user: { select: { email: true, displayName: true } },
            project: { select: { name: true } },
          },
          take: 50000,
        }),
        prisma.projectWorkOrder.findMany({
          where: { tenantId: ctx.tenantId, workDate: { gte: from, lte: to } },
          select: { userId: true, projectId: true },
          take: 200000,
        }),
      ]);

      const logged = new Set(workOrders.map((w) => `${w.userId}::${w.projectId}`));
      const rows = assignments
        .filter((a) => !logged.has(`${a.userId}::${a.projectId}`))
        .map((a) => ({
          userName: a.user.displayName?.trim() || a.user.email,
          userEmail: a.user.email,
          projectName: a.project.name,
          month: label,
          status: 'Nema unosa',
        }))
        .sort((a, b) => {
          const byUser = a.userName.localeCompare(b.userName, 'sr');
          if (byUser !== 0) return byUser;
          return a.projectName.localeCompare(b.projectName, 'sr');
        });

      return {
        title: `Bez evidencije rada – ${label}`,
        columns: [
          { key: 'userName', label: 'Korisnik' },
          { key: 'userEmail', label: 'Email' },
          { key: 'projectName', label: 'Projekat' },
          { key: 'month', label: 'Mesec' },
          { key: 'status', label: 'Status' },
        ],
        rows,
        meta: { year, month, monthLabel: label, rowCount: rows.length },
      };
    },
  };
}

export function projectTimeProjectsOverHoursTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'project_time_projects_over_hours',
    title: 'Projekti sa prekoračenjem sati',
    description: 'Projekti čiji ukupni utrošeni sati u mesecu prelaze zadati prag.',
    paramsSchema: { year: 'number', month: 'number', hoursThreshold: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const threshold = Math.max(1, Number(params.hoursThreshold ?? 100));
      const period = resolvePeriod(ctx.now, {
        year: params.year != null ? Number(params.year) : null,
        month: params.month != null ? Number(params.month) : null,
      });
      const { from, to, label, year, month } = {
        from: period.from,
        to: period.to,
        label: period.label,
        year: period.year,
        month: period.month ?? ctx.now.getMonth() + 1,
      };

      const workOrders = await prisma.projectWorkOrder.findMany({
        where: { tenantId: ctx.tenantId, workDate: { gte: from, lte: to } },
        select: { projectId: true, hours: true, project: { select: { name: true } } },
        take: 200000,
      });

      const totals = new Map<string, { name: string; hours: number }>();
      for (const w of workOrders) {
        const prev = totals.get(w.projectId);
        if (prev) prev.hours += w.hours;
        else totals.set(w.projectId, { name: w.project.name, hours: w.hours });
      }

      const rows = Array.from(totals.values())
        .filter((t) => t.hours > threshold)
        .map((t) => ({
          projectName: t.name,
          totalHours: Number(t.hours.toFixed(2)),
          threshold,
          month: label,
        }))
        .sort((a, b) => b.totalHours - a.totalHours);

      return {
        title: `Projekti preko ${threshold} sati – ${label}`,
        columns: [
          { key: 'projectName', label: 'Projekat' },
          { key: 'totalHours', label: 'Ukupno sati' },
          { key: 'threshold', label: 'Prag (sati)' },
          { key: 'month', label: 'Mesec' },
        ],
        rows,
        meta: { year, month, monthLabel: label, hoursThreshold: threshold, rowCount: rows.length },
      };
    },
  };
}

export function projectTimeWeeklyByUserAndProjectTemplate(
  prisma: PrismaService,
): ReportTemplate {
  return {
    key: 'project_time_weekly_by_user_and_project',
    title: 'Evidencija rada – nedeljni pregled',
    description: 'Utrošeni sati po korisniku i projektu za poslednjih 7 dana.',
    paramsSchema: { days: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const days = Math.max(1, Number(params.days ?? 7));
      const since = daysSince(ctx.now, days);
      const label = `poslednjih ${days} dana`;

      const workOrders = await prisma.projectWorkOrder.findMany({
        where: { tenantId: ctx.tenantId, workDate: { gte: since } },
        select: {
          hours: true,
          userId: true,
          projectId: true,
          user: { select: { email: true, displayName: true } },
          project: { select: { name: true } },
        },
        take: 200000,
      });

      const { rows, grandTotal } = aggregateUserProjectHours(workOrders, label);
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
          { userName: '__UKUPNO__', userEmail: '', projectName: '', hours: grandTotal, period: label },
          ...rows,
        ],
        meta: { days, rowCount: rows.length },
      };
    },
  };
}
