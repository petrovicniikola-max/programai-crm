import { Injectable } from '@nestjs/common';
import { LeaveEntitlementKind, LeaveRequestStatus, LeaveType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  addMonths,
  calendarYear,
  fiscalYearExpiresAt,
  fiscalYearLabel,
  formatDateDdMmYyyy,
  parseDateOnly,
} from './leave-date.util';

export interface SeniorityRow {
  minYears: number;
  maxYears: number | null;
  bonusDays: number;
}

export const DEFAULT_SENIORITY_TABLE: SeniorityRow[] = [
  { minYears: 0, maxYears: 4, bonusDays: 0 },
  { minYears: 5, maxYears: 9, bonusDays: 1 },
  { minYears: 10, maxYears: 14, bonusDays: 2 },
  { minYears: 15, maxYears: 19, bonusDays: 3 },
  { minYears: 20, maxYears: 24, bonusDays: 4 },
  { minYears: 25, maxYears: null, bonusDays: 5 },
];

@Injectable()
export class LeaveBalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateSettings(tenantId: string) {
    const existing = await this.prisma.tenantLeaveSettings.findUnique({ where: { tenantId } });
    if (existing) return existing;
    return this.prisma.tenantLeaveSettings.create({
      data: {
        tenantId,
        seniorityBonusTable: DEFAULT_SENIORITY_TABLE as unknown as Prisma.InputJsonValue,
      },
    });
  }

  getSeniorityYears(user: {
    employmentDate: Date | null;
    totalWorkExperienceYears: number | null;
  }): number {
    if (user.totalWorkExperienceYears != null) return user.totalWorkExperienceYears;
    if (!user.employmentDate) return 0;
    const start = parseDateOnly(user.employmentDate);
    const now = new Date();
    let years = now.getFullYear() - start.getFullYear();
    const m = now.getMonth() - start.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < start.getDate())) years--;
    return Math.max(0, years);
  }

  bonusFromTable(years: number, table: SeniorityRow[]): number {
    const rows = table.length ? table : DEFAULT_SENIORITY_TABLE;
    for (const row of rows) {
      const max = row.maxYears ?? Infinity;
      if (years >= row.minYears && years <= max) return row.bonusDays;
    }
    return 0;
  }

  /** Employment start for annual-leave eligibility (HR date, or account createdAt as fallback). */
  employmentStartForEligibility(user: {
    employmentDate: Date | null;
    createdAt: Date;
  }): Date {
    return user.employmentDate ?? user.createdAt;
  }

  getAnnualEligibility(user: { employmentDate: Date | null; createdAt: Date }) {
    const missingEmploymentDate = !user.employmentDate;
    const start = parseDateOnly(this.employmentStartForEligibility(user));
    const eligibleFrom = addMonths(start, 1);
    const eligible = new Date() >= eligibleFrom;
    return { eligible, eligibleFrom, missingEmploymentDate, employmentStart: start };
  }

  isAnnualEligible(user: { employmentDate: Date | null; createdAt: Date }): boolean {
    return this.getAnnualEligibility(user).eligible;
  }

  annualEligibilityMessage(user: { employmentDate: Date | null; createdAt: Date }): string {
    const info = this.getAnnualEligibility(user);
    if (info.eligible) return '';
    const from = formatDateDdMmYyyy(info.eligibleFrom);
    if (info.missingEmploymentDate) {
      return `Godišnji odmor je dostupan od ${from}. Administrator treba da unese datum zaposlenja u podešavanjima korisnika radi tačnog obračuna.`;
    }
    return `Godišnji odmor je dostupan od ${from} (mesec dana od početka radnog odnosa).`;
  }

  computeAnnualDays(
    settings: { minAnnualDays: number; seniorityBonusTable: unknown },
    seniorityYears: number,
    contractType: string,
    employmentDate: Date | null,
    contractEndDate: Date | null,
    entitlementYear: number,
  ): { baseDays: number; seniorityBonusDays: number; totalDays: number } {
    const table = (settings.seniorityBonusTable as SeniorityRow[]) || DEFAULT_SENIORITY_TABLE;
    const bonus = this.bonusFromTable(seniorityYears, table);
    let base = Math.max(settings.minAnnualDays, 20);

    if (contractType === 'FIXED_TERM' && employmentDate && contractEndDate) {
      const fyStart = new Date(entitlementYear, 6, 1);
      const fyEnd = new Date(entitlementYear + 1, 5, 30);
      const empStart = parseDateOnly(employmentDate);
      const empEnd = parseDateOnly(contractEndDate);
      const periodStart = empStart > fyStart ? empStart : fyStart;
      const periodEnd = empEnd < fyEnd ? empEnd : fyEnd;
      if (periodEnd < periodStart) {
        return { baseDays: 0, seniorityBonusDays: 0, totalDays: 0 };
      }
      const months =
        (periodEnd.getFullYear() - periodStart.getFullYear()) * 12 +
        (periodEnd.getMonth() - periodStart.getMonth()) +
        1;
      const fullYear = base + bonus;
      const proportional = Math.round((fullYear * months) / 12);
      return { baseDays: base, seniorityBonusDays: bonus, totalDays: proportional };
    }

    return { baseDays: base, seniorityBonusDays: bonus, totalDays: base + bonus };
  }

  async ensureEntitlements(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user || !this.isAnnualEligible(user)) return [];

    const settings = await this.getOrCreateSettings(tenantId);
    const today = new Date();
    const fy = fiscalYearLabel(today, settings.fiscalYearStartMonth);
    const seniority = this.getSeniorityYears(user);
    const days = this.computeAnnualDays(
      settings,
      seniority,
      user.employmentContractType,
      user.employmentDate,
      user.contractEndDate,
      fy,
    );

    const current = await this.prisma.leaveEntitlement.upsert({
      where: {
        tenantId_userId_entitlementYear_kind: {
          tenantId,
          userId,
          entitlementYear: fy,
          kind: LeaveEntitlementKind.CURRENT,
        },
      },
      create: {
        tenantId,
        userId,
        entitlementYear: fy,
        kind: LeaveEntitlementKind.CURRENT,
        baseDays: days.baseDays,
        seniorityBonusDays: days.seniorityBonusDays,
        totalDays: days.totalDays,
        expiresAt: fiscalYearExpiresAt(fy),
      },
      update: {},
    });

    const prevYear = fy - 1;
    const previous = await this.prisma.leaveEntitlement.findUnique({
      where: {
        tenantId_userId_entitlementYear_kind: {
          tenantId,
          userId,
          entitlementYear: prevYear,
          kind: LeaveEntitlementKind.CURRENT,
        },
      },
    });

    if (previous && previous.expiresAt > today) {
      await this.prisma.leaveEntitlement.upsert({
        where: {
          tenantId_userId_entitlementYear_kind: {
            tenantId,
            userId,
            entitlementYear: prevYear,
            kind: LeaveEntitlementKind.PREVIOUS,
          },
        },
        create: {
          tenantId,
          userId,
          entitlementYear: prevYear,
          kind: LeaveEntitlementKind.PREVIOUS,
          baseDays: previous.baseDays,
          seniorityBonusDays: previous.seniorityBonusDays,
          totalDays: previous.totalDays,
          usedDays: previous.usedDays,
          expiresAt: previous.expiresAt,
        },
        update: {},
      });
    }

    const all = await this.prisma.leaveEntitlement.findMany({
      where: { tenantId, userId },
      orderBy: [{ kind: 'asc' }, { expiresAt: 'asc' }],
    });
    return all.length ? all : [current];
  }

  async getAnnualBalances(tenantId: string, userId: string) {
    const rows = await this.ensureEntitlements(tenantId, userId);
    const now = new Date();
    return rows
      .filter((r) => r.expiresAt >= now)
      .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
      .map((r) => ({
      id: r.id,
      kind: r.kind,
      entitlementYear: r.entitlementYear,
      totalDays: r.totalDays,
      usedDays: r.usedDays,
      availableDays: Math.max(0, r.totalDays - r.usedDays),
      expiresAt: r.expiresAt,
    }));
  }

  async getAdjustmentSum(
    tenantId: string,
    userId: string,
    type: LeaveType,
    year: number,
  ): Promise<number> {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);
    const agg = await this.prisma.leaveBalanceAdjustment.aggregate({
      where: {
        tenantId,
        userId,
        type,
        occurredOn: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0;
  }

  /** Returns 0 if adjustment table is missing or query fails (e.g. before migration). */
  async safeAdjustmentSum(
    tenantId: string,
    userId: string,
    type: LeaveType,
    year: number,
  ): Promise<number> {
    try {
      return await this.getAdjustmentSum(tenantId, userId, type, year);
    } catch {
      return 0;
    }
  }

  async getPersonalUsed(tenantId: string, userId: string, year?: number) {
    const y = year ?? calendarYear(new Date());
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31, 23, 59, 59);
    const approved = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        userId,
        type: LeaveType.PERSONAL,
        status: LeaveRequestStatus.APPROVED,
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    return approved.reduce((s, r) => s + r.totalWorkingDays, 0);
  }

  async getPaidAbsenceUsed(tenantId: string, userId: string, year?: number) {
    const y = year ?? calendarYear(new Date());
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31, 23, 59, 59);
    const approved = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        userId,
        type: LeaveType.PAID_ABSENCE,
        status: LeaveRequestStatus.APPROVED,
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    return approved.reduce((s, r) => s + r.totalWorkingDays, 0);
  }

  async getPaidAbsenceUsedForSubtype(
    tenantId: string,
    userId: string,
    subtype: string,
    year?: number,
  ) {
    const y = year ?? calendarYear(new Date());
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31, 23, 59, 59);
    const approved = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        userId,
        type: LeaveType.PAID_ABSENCE,
        paidAbsenceSubtype: subtype as never,
        status: LeaveRequestStatus.APPROVED,
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    return approved.reduce((s, r) => s + r.totalWorkingDays, 0);
  }

  async forecastAnnual(
    tenantId: string,
    userId: string,
    requestedDays: number,
  ): Promise<{ available: number; requested: number; remaining: number; buckets: { id: string; available: number }[] }> {
    const buckets = await this.getAnnualBalances(tenantId, userId);
    const year = calendarYear(new Date());
    const adj = await this.safeAdjustmentSum(tenantId, userId, LeaveType.ANNUAL, year);
    const available = buckets.reduce((s, b) => s + b.availableDays, 0) + adj;
    const remaining = available - requestedDays;
    return {
      available,
      requested: requestedDays,
      remaining,
      buckets: buckets.map((b) => ({ id: b.id, available: b.availableDays })),
    };
  }

  async pickEntitlementForDeduction(
    tenantId: string,
    userId: string,
    days: number,
  ): Promise<string | null> {
    const buckets = await this.prisma.leaveEntitlement.findMany({
      where: { tenantId, userId, expiresAt: { gte: new Date() } },
      orderBy: [{ kind: 'desc' }, { expiresAt: 'asc' }],
    });
    let remaining = days;
    for (const b of buckets) {
      const avail = b.totalDays - b.usedDays;
      if (avail >= remaining) return b.id;
      if (avail > 0) {
        remaining -= avail;
        if (remaining <= 0) return b.id;
      }
    }
    return buckets[0]?.id ?? null;
  }

  /**
   * Deduct approved annual leave: use entitlement buckets first, then consume manual
   * adjustment balance (negative adjustment row records the remainder).
   */
  async consumeAnnualLeaveDays(
    tenantId: string,
    userId: string,
    days: number,
    createdByUserId?: string | null,
  ) {
    let remaining = days;
    const buckets = await this.prisma.leaveEntitlement.findMany({
      where: { tenantId, userId, expiresAt: { gte: new Date() } },
      orderBy: [{ kind: 'desc' }, { expiresAt: 'asc' }],
    });

    for (const b of buckets) {
      const avail = b.totalDays - b.usedDays;
      if (avail <= 0) continue;
      const take = Math.min(avail, remaining);
      await this.prisma.leaveEntitlement.update({
        where: { id: b.id },
        data: { usedDays: b.usedDays + take },
      });
      remaining -= take;
      if (remaining <= 0) return;
    }

    if (remaining > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await this.prisma.leaveBalanceAdjustment.create({
        data: {
          tenantId,
          userId,
          type: LeaveType.ANNUAL,
          amount: -remaining,
          occurredOn: today,
          comment: 'Potrošnja zbog odobrenog godišnjeg odsustva',
          createdByUserId: createdByUserId ?? null,
        },
      });
    }
  }

  /** Reverse consumeAnnualLeaveDays when an approved annual request is cancelled. */
  async restoreAnnualLeaveDays(
    tenantId: string,
    userId: string,
    days: number,
    createdByUserId?: string | null,
  ) {
    let remaining = days;
    const buckets = await this.prisma.leaveEntitlement.findMany({
      where: { tenantId, userId, expiresAt: { gte: new Date() } },
      orderBy: [{ kind: 'desc' }, { expiresAt: 'asc' }],
    });

    for (let i = buckets.length - 1; i >= 0 && remaining > 0; i--) {
      const b = buckets[i]!;
      if (b.usedDays <= 0) continue;
      const restore = Math.min(b.usedDays, remaining);
      await this.prisma.leaveEntitlement.update({
        where: { id: b.id },
        data: { usedDays: b.usedDays - restore },
      });
      remaining -= restore;
    }

    if (remaining > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await this.prisma.leaveBalanceAdjustment.create({
        data: {
          tenantId,
          userId,
          type: LeaveType.ANNUAL,
          amount: remaining,
          occurredOn: today,
          comment: 'Povraćaj zbog otkazanog godišnjeg odsustva',
          createdByUserId: createdByUserId ?? null,
        },
      });
    }
  }

  /** Set carry-over leave from the previous fiscal year (must be used by 30 June). */
  async setPreviousLeaveBalance(tenantId: string, userId: string, availableDays: number) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new Error('User not found');

    await this.ensureEntitlements(tenantId, userId);
    const settings = await this.getOrCreateSettings(tenantId);
    const fy = fiscalYearLabel(new Date(), settings.fiscalYearStartMonth);
    const prevYear = fy - 1;
    const avail = Math.max(0, availableDays);

    const existing = await this.prisma.leaveEntitlement.findUnique({
      where: {
        tenantId_userId_entitlementYear_kind: {
          tenantId,
          userId,
          entitlementYear: prevYear,
          kind: LeaveEntitlementKind.PREVIOUS,
        },
      },
    });
    const usedDays = existing ? Math.min(existing.usedDays, avail + existing.usedDays) : 0;
    const totalDays = avail + usedDays;

    if (totalDays <= 0) {
      if (existing) {
        await this.prisma.leaveEntitlement.delete({ where: { id: existing.id } });
      }
      return { previousAvailable: 0, previousTotal: 0, previousUsed: 0 };
    }

    const row = await this.prisma.leaveEntitlement.upsert({
      where: {
        tenantId_userId_entitlementYear_kind: {
          tenantId,
          userId,
          entitlementYear: prevYear,
          kind: LeaveEntitlementKind.PREVIOUS,
        },
      },
      create: {
        tenantId,
        userId,
        entitlementYear: prevYear,
        kind: LeaveEntitlementKind.PREVIOUS,
        baseDays: totalDays,
        seniorityBonusDays: 0,
        totalDays,
        usedDays,
        expiresAt: fiscalYearExpiresAt(fy),
      },
      update: {
        baseDays: totalDays,
        totalDays,
        usedDays,
        expiresAt: fiscalYearExpiresAt(fy),
      },
    });

    return {
      previousAvailable: Math.max(0, row.totalDays - row.usedDays),
      previousTotal: row.totalDays,
      previousUsed: row.usedDays,
    };
  }

  async getAnnualBreakdown(tenantId: string, userId: string) {
    const settings = await this.getOrCreateSettings(tenantId);
    const buckets = await this.getAnnualBalances(tenantId, userId);
    const fy = fiscalYearLabel(new Date(), settings.fiscalYearStartMonth);
    const adj = await this.safeAdjustmentSum(tenantId, userId, LeaveType.ANNUAL, calendarYear(new Date()));

    const previous = buckets.filter((b) => b.kind === LeaveEntitlementKind.PREVIOUS);
    const current = buckets.filter((b) => b.kind !== LeaveEntitlementKind.PREVIOUS);
    const previousAvailable = previous.reduce((s, b) => s + b.availableDays, 0);
    const currentBucketAvailable = current.reduce((s, b) => s + b.availableDays, 0);
    const currentAvailable = currentBucketAvailable + adj;

    return {
      fiscalYear: fy,
      fiscalYearEnd: fiscalYearExpiresAt(fy).toISOString().slice(0, 10),
      previous: {
        available: previousAvailable,
        total: previous.reduce((s, b) => s + b.totalDays, 0),
        used: previous.reduce((s, b) => s + b.usedDays, 0),
      },
      current: {
        available: Math.max(0, currentAvailable),
        total: current.reduce((s, b) => s + b.totalDays, 0) + adj,
        used: current.reduce((s, b) => s + b.usedDays, 0),
        adjustment: adj,
      },
      totalAvailable: Math.max(0, previousAvailable + currentAvailable),
    };
  }

  async deductAnnualDays(entitlementId: string, days: number) {
    let remaining = days;
    const primary = await this.prisma.leaveEntitlement.findUnique({ where: { id: entitlementId } });
    if (!primary) return;

    const buckets = await this.prisma.leaveEntitlement.findMany({
      where: {
        tenantId: primary.tenantId,
        userId: primary.userId,
        expiresAt: { gte: new Date() },
      },
      orderBy: [{ kind: 'desc' }, { expiresAt: 'asc' }],
    });

    for (const b of buckets) {
      const avail = b.totalDays - b.usedDays;
      if (avail <= 0) continue;
      const take = Math.min(avail, remaining);
      await this.prisma.leaveEntitlement.update({
        where: { id: b.id },
        data: { usedDays: b.usedDays + take },
      });
      remaining -= take;
      if (remaining <= 0) break;
    }
  }
}
