import { PrismaService } from '../../prisma/prisma.service';
import { resolvePeriod } from '../report-date-utils';
import { ReportTemplate, ReportTableResult } from './types';

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'Godišnji odmor',
  PAID_ABSENCE: 'Plaćeno odsustvo',
  PERSONAL: 'Lični dan',
};

export function leaveApprovedInMonthTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'leave_approved_in_month',
    title: 'Odobrena odsustva po periodu',
    description:
      'Odobrena odsustva u izabranom mesecu ili celoj godini (godina + mesec u promptu ili podešavanjima).',
    paramsSchema: { year: 'number', month: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const period = resolvePeriod(ctx.now, {
        year: params.year != null ? Number(params.year) : null,
        month: params.month != null ? Number(params.month) : null,
      });

      const requests = await prisma.leaveRequest.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: 'APPROVED',
          startDate: { lte: period.to },
          endDate: { gte: period.from },
        },
        select: {
          type: true,
          startDate: true,
          endDate: true,
          totalWorkingDays: true,
          user: { select: { email: true, displayName: true } },
        },
        orderBy: { startDate: 'asc' },
        take: 50000,
      });

      const rows = requests.map((r) => ({
        userName: r.user.displayName?.trim() || r.user.email,
        userEmail: r.user.email,
        type: LEAVE_TYPE_LABELS[r.type] ?? r.type,
        startDate: r.startDate.toISOString().slice(0, 10),
        endDate: r.endDate.toISOString().slice(0, 10),
        workingDays: Number(r.totalWorkingDays.toFixed(1)),
        period: period.label,
      }));

      return {
        title: `Odobrena odsustva – ${period.label}`,
        columns: [
          { key: 'userName', label: 'Korisnik' },
          { key: 'userEmail', label: 'Email' },
          { key: 'type', label: 'Tip' },
          { key: 'startDate', label: 'Od' },
          { key: 'endDate', label: 'Do' },
          { key: 'workingDays', label: 'Radni dani' },
          { key: 'period', label: 'Period' },
        ],
        rows,
        meta: {
          year: period.year,
          month: period.month ?? null,
          periodKind: period.kind,
          periodLabel: period.label,
          rowCount: rows.length,
        },
      };
    },
  };
}

export function leaveLowAnnualBalanceTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'leave_low_annual_balance',
    title: 'Mali preostali godišnji odmor',
    description: 'Korisnici sa preostalim godišnjim odmorom ispod zadatog praga.',
    paramsSchema: { minDays: 'number', year: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const minDays = Math.max(0, Number(params.minDays ?? 5));
      const year = params.year != null ? Number(params.year) : ctx.now.getFullYear();

      const entitlements = await prisma.leaveEntitlement.findMany({
        where: {
          tenantId: ctx.tenantId,
          entitlementYear: year,
          kind: 'CURRENT',
        },
        select: {
          totalDays: true,
          usedDays: true,
          user: { select: { email: true, displayName: true, isActive: true } },
        },
        take: 10000,
      });

      const rows = entitlements
        .filter((e) => e.user.isActive)
        .map((e) => {
          const remaining = Number((e.totalDays - e.usedDays).toFixed(1));
          return {
            userName: e.user.displayName?.trim() || e.user.email,
            userEmail: e.user.email,
            totalDays: Number(e.totalDays.toFixed(1)),
            usedDays: Number(e.usedDays.toFixed(1)),
            remainingDays: remaining,
            year,
          };
        })
        .filter((r) => r.remainingDays < minDays)
        .sort((a, b) => a.remainingDays - b.remainingDays);

      return {
        title: `Godišnji odmor ispod ${minDays} dana (${year})`,
        columns: [
          { key: 'userName', label: 'Korisnik' },
          { key: 'userEmail', label: 'Email' },
          { key: 'totalDays', label: 'Ukupno' },
          { key: 'usedDays', label: 'Iskorišćeno' },
          { key: 'remainingDays', label: 'Preostalo' },
          { key: 'year', label: 'Godina' },
        ],
        rows,
        meta: { minDays, year, rowCount: rows.length },
      };
    },
  };
}
