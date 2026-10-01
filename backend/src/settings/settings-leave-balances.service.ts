import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LeaveBalanceService } from '../leave/leave-balance.service';
import { CreateLeaveAdjustmentDto } from './dto/leave-settings.dto';
import { calendarYear, parseDateOnly } from '../leave/leave-date.util';

export interface HistoryRow {
  occurredOn: string;
  description: string;
  used: number | null;
  accrued: number | null;
  balance: number;
  kind: 'accrual' | 'used' | 'adjustment' | 'request';
}

@Injectable()
export class SettingsLeaveBalancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: LeaveBalanceService,
  ) {}

  async listUserBalances(tenantId: string, type: 'ANNUAL' | 'PERSONAL') {
    const settings = await this.balance.getOrCreateSettings(tenantId);
    const users = await this.prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, email: true, displayName: true, employmentDate: true, createdAt: true },
      orderBy: [{ displayName: 'asc' }, { email: 'asc' }],
    });

    const year = calendarYear(new Date());
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    if (type === 'PERSONAL') {
      const [usedRows, adjRows] = await Promise.all([
        this.prisma.leaveRequest.groupBy({
          by: ['userId'],
          where: {
            tenantId,
            type: LeaveType.PERSONAL,
            status: 'APPROVED',
            startDate: { lte: yearEnd },
            endDate: { gte: yearStart },
          },
          _sum: { totalWorkingDays: true },
        }),
        this.prisma.leaveBalanceAdjustment
          .groupBy({
            by: ['userId'],
            where: {
              tenantId,
              type: LeaveType.PERSONAL,
              occurredOn: { gte: yearStart, lte: yearEnd },
            },
            _sum: { amount: true },
          })
          .catch(() => [] as { userId: string; _sum: { amount: number | null } }[]),
      ]);
      const usedMap = new Map<string, number>(
        usedRows.map((r) => [r.userId, r._sum.totalWorkingDays ?? 0] as [string, number]),
      );
      const adjMap = new Map<string, number>(
        adjRows.map((r) => [r.userId, r._sum.amount ?? 0] as [string, number]),
      );
      return users.map((u) => {
        const used = usedMap.get(u.id) ?? 0;
        const adjustmentSum = adjMap.get(u.id) ?? 0;
        const total = settings.personalDaysPerYear + adjustmentSum;
        return {
          userId: u.id,
          email: u.email,
          displayName: u.displayName,
          employmentDate: u.employmentDate,
          available: Math.max(0, total - used),
          total,
          used,
        };
      });
    }

    const userIds = users.map((u) => u.id);
    const eligible = users.filter((u) => this.balance.isAnnualEligible(u));
    await Promise.all(eligible.map((u) => this.balance.ensureEntitlements(tenantId, u.id)));

    const [entitlementRows, adjRows] = await Promise.all([
      this.prisma.leaveEntitlement.findMany({
        where: { tenantId, userId: { in: userIds }, expiresAt: { gte: new Date() } },
      }),
      this.prisma.leaveBalanceAdjustment
        .groupBy({
          by: ['userId'],
          where: {
            tenantId,
            type: LeaveType.ANNUAL,
            occurredOn: { gte: yearStart, lte: yearEnd },
          },
          _sum: { amount: true },
        })
        .catch(() => [] as { userId: string; _sum: { amount: number | null } }[]),
    ]);

    const entByUser = new Map<string, typeof entitlementRows>();
    for (const row of entitlementRows) {
      const list = entByUser.get(row.userId) ?? [];
      list.push(row);
      entByUser.set(row.userId, list);
    }
    const adjMap = new Map<string, number>(
      adjRows.map((r) => [r.userId, r._sum.amount ?? 0] as [string, number]),
    );

    return users.map((u) => {
      const buckets = entByUser.get(u.id) ?? [];
      const adjustmentSum = adjMap.get(u.id) ?? 0;
      const previousBuckets = buckets.filter((b) => b.kind === 'PREVIOUS');
      const currentBuckets = buckets.filter((b) => b.kind !== 'PREVIOUS');
      const previousAvailable = previousBuckets.reduce(
        (s, b) => s + Math.max(0, b.totalDays - b.usedDays),
        0,
      );
      const currentBucketAvailable = currentBuckets.reduce(
        (s, b) => s + Math.max(0, b.totalDays - b.usedDays),
        0,
      );
      const currentAvailable = currentBucketAvailable + adjustmentSum;
      const bucketAvailable = previousAvailable + currentBucketAvailable;
      const bucketTotal = buckets.reduce((s, b) => s + b.totalDays, 0);
      const used = buckets.reduce((s, b) => s + b.usedDays, 0);
      return {
        userId: u.id,
        email: u.email,
        displayName: u.displayName,
        employmentDate: u.employmentDate,
        previousAvailable,
        currentAvailable: Math.max(0, currentAvailable),
        available: Math.max(0, bucketAvailable + adjustmentSum),
        total: bucketTotal + adjustmentSum,
        used,
      };
    });
  }

  async getAnnualDetail(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    return this.balance.getAnnualBreakdown(tenantId, userId);
  }

  async setPreviousLeave(tenantId: string, userId: string, availableDays: number) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    if (availableDays < 0) throw new BadRequestException('availableDays must be >= 0');
    return this.balance.setPreviousLeaveBalance(tenantId, userId, availableDays);
  }

  async createAdjustment(
    tenantId: string,
    actorUserId: string,
    dto: CreateLeaveAdjustmentDto,
  ) {
    if (dto.type !== 'ANNUAL' && dto.type !== 'PERSONAL') {
      throw new BadRequestException('type must be ANNUAL or PERSONAL');
    }
    if (!dto.amount || dto.amount === 0) {
      throw new BadRequestException('amount must be non-zero');
    }

    const user = await this.prisma.user.findFirst({ where: { id: dto.userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    const occurredOn = parseDateOnly(dto.occurredOn);
    const leaveType = dto.type === 'ANNUAL' ? LeaveType.ANNUAL : LeaveType.PERSONAL;

    // Annual adjustments live only in leaveBalanceAdjustment; list/forecast add that sum
    // on top of entitlement buckets. Do not also mutate entitlement.totalDays (double count).
    if (leaveType === LeaveType.ANNUAL) {
      await this.balance.ensureEntitlements(tenantId, user.id);
    }

    try {
      return await this.prisma.leaveBalanceAdjustment.create({
        data: {
          tenantId,
          userId: user.id,
          type: leaveType,
          amount: dto.amount,
          occurredOn,
          comment: dto.comment?.trim() || null,
          createdByUserId: actorUserId,
        },
      });
    } catch {
      throw new BadRequestException(
        'Leave adjustments table is missing. Run: npx prisma migrate deploy',
      );
    }
  }

  async getUserHistory(
    tenantId: string,
    userId: string,
    type: 'ANNUAL' | 'PERSONAL',
    year: number,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, email: true, displayName: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const leaveType = type === 'ANNUAL' ? LeaveType.ANNUAL : LeaveType.PERSONAL;
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);

    const events: {
      date: Date;
      description: string;
      used: number | null;
      accrued: number | null;
      sort: number;
    }[] = [];

    if (leaveType === LeaveType.ANNUAL) {
      const ents = await this.prisma.leaveEntitlement.findMany({
        where: {
          tenantId,
          userId,
          createdAt: { gte: start, lte: end },
        },
      });
      for (const e of ents) {
        events.push({
          date: e.createdAt,
          description: `Godišnji odmor ${e.entitlementYear} (${e.kind})`,
          used: null,
          accrued: e.totalDays,
          sort: 1,
        });
      }
    } else {
      const settings = await this.balance.getOrCreateSettings(tenantId);
      events.push({
        date: start,
        description: 'Početni fond slobodnih dana',
        used: null,
        accrued: settings.personalDaysPerYear,
        sort: 0,
      });
    }

    let adjustments: { amount: number; occurredOn: Date; comment: string | null }[] = [];
    try {
      adjustments = await this.prisma.leaveBalanceAdjustment.findMany({
        where: {
          tenantId,
          userId,
          type: leaveType,
          occurredOn: { gte: start, lte: end },
        },
      });
    } catch {
      adjustments = [];
    }
    for (const a of adjustments) {
      events.push({
        date: parseDateOnly(a.occurredOn),
        description: a.comment?.trim() || 'Ručna korekcija',
        used: a.amount < 0 ? Math.abs(a.amount) : null,
        accrued: a.amount > 0 ? a.amount : null,
        sort: 2,
      });
    }

    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        userId,
        type: leaveType,
        status: 'APPROVED',
        startDate: { lte: end },
        endDate: { gte: start },
      },
      orderBy: { startDate: 'asc' },
    });
    for (const r of requests) {
      events.push({
        date: parseDateOnly(r.startDate),
        description: `Odobreno odsustvo ${r.startDate.toISOString().slice(0, 10)} – ${r.endDate.toISOString().slice(0, 10)}`,
        used: r.totalWorkingDays,
        accrued: null,
        sort: 3,
      });
    }

    events.sort((a, b) => a.date.getTime() - b.date.getTime() || a.sort - b.sort);

    let running = 0;
    const rows: HistoryRow[] = events.map((e) => {
      if (e.accrued != null) running += e.accrued;
      if (e.used != null) running -= e.used;
      return {
        occurredOn: e.date.toISOString().slice(0, 10),
        description: e.description,
        used: e.used,
        accrued: e.accrued,
        balance: Math.round(running * 10) / 10,
        kind: e.sort === 2 ? 'adjustment' : e.used ? 'used' : 'accrual',
      };
    });

    const totalUsed = rows.reduce((s, r) => s + (r.used ?? 0), 0);
    const totalAdjustments = adjustments.reduce((s, a) => s + a.amount, 0);

    let available = 0;
    if (leaveType === LeaveType.ANNUAL) {
      const buckets = await this.balance.getAnnualBalances(tenantId, userId);
      const adj = await this.balance.safeAdjustmentSum(
        tenantId,
        userId,
        LeaveType.ANNUAL,
        year,
      );
      available = Math.max(
        0,
        buckets.reduce((s, b) => s + b.availableDays, 0) + adj,
      );
    } else {
      const settings = await this.balance.getOrCreateSettings(tenantId);
      const used = await this.balance.getPersonalUsed(tenantId, userId, year);
      const adj = await this.balance.safeAdjustmentSum(
        tenantId,
        userId,
        LeaveType.PERSONAL,
        year,
      );
      available = Math.max(0, settings.personalDaysPerYear + adj - used);
    }

    return {
      user,
      year,
      type,
      available,
      totalUsed,
      totalAdjustments,
      rows,
    };
  }

  historyToCsv(data: Awaited<ReturnType<typeof this.getUserHistory>>): string {
    const lines = [
      'Occurred on,Description,Used,Accrued,Balance',
      ...data.rows.map(
        (r) =>
          `${r.occurredOn},"${r.description.replace(/"/g, '""')}",${r.used ?? ''},${r.accrued ?? ''},${r.balance}`,
      ),
    ];
    return lines.join('\n');
  }
}
