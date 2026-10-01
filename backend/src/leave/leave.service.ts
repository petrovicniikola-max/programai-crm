import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LeaveRequestStatus,
  LeaveType,
  PaidAbsenceSubtype,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LeaveBalanceService } from './leave-balance.service';
import { WorkingDaysCalculator } from './working-days.calculator';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { LeaveDecisionDto } from './dto/decision.dto';
import { parseDateOnly, formatDateOnly, calendarYear } from './leave-date.util';
import { LeaveDocumentService } from './leave-document.service';
import { LeaveEmailService } from './leave-email.service';

const ACTIVE_STATUSES: LeaveRequestStatus[] = [
  LeaveRequestStatus.PENDING,
  LeaveRequestStatus.APPROVED,
];

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: LeaveBalanceService,
    private readonly calculator: WorkingDaysCalculator,
    private readonly documents: LeaveDocumentService,
    private readonly email: LeaveEmailService,
  ) {}

  private async holidaySet(tenantId: string): Promise<Set<string>> {
    const rows = await this.prisma.publicHoliday.findMany({ where: { tenantId } });
    const set = new Set<string>();
    for (const h of rows) {
      const d = parseDateOnly(h.date);
      set.add(formatDateOnly(d));
      if (h.isRecurring) {
        const now = new Date();
        for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 2; y++) {
          set.add(formatDateOnly(new Date(y, d.getMonth(), d.getDate())));
        }
      }
    }
    return set;
  }

  private async resolveApproverId(tenantId: string, userId: string): Promise<string | null> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (user?.leaveApproverId) return user.leaveApproverId;
    const settings = await this.balance.getOrCreateSettings(tenantId);
    return settings.defaultApproverId;
  }

  private async validateRequest(
    tenantId: string,
    userId: string,
    dto: CreateLeaveRequestDto,
    excludeRequestId?: string,
  ) {
    const start = parseDateOnly(dto.startDate);
    const end = parseDateOnly(dto.endDate);
    if (end < start) throw new BadRequestException('endDate must be >= startDate');

    const holidays = await this.holidaySet(tenantId);
    const { entries, totalWorkingDays } = this.calculator.buildBreakdown(
      start,
      end,
      dto.type,
      holidays,
      dto.dayOverrides,
    );

    if (totalWorkingDays <= 0) {
      throw new BadRequestException('No working days in selected range');
    }

    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        tenantId,
        userId,
        status: { in: ACTIVE_STATUSES },
        ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (overlap) throw new BadRequestException('Overlapping leave request exists');

    const settings = await this.balance.getOrCreateSettings(tenantId);
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    let previewSummary: { available: number; requested: number; remaining: number } | undefined;

    if (dto.type === LeaveType.ANNUAL) {
      if (!this.balance.isAnnualEligible(user)) {
        throw new BadRequestException(this.balance.annualEligibilityMessage(user));
      }
      const forecast = await this.balance.forecastAnnual(tenantId, userId, totalWorkingDays);
      if (forecast.remaining < 0) {
        throw new BadRequestException('Insufficient annual leave balance');
      }
      previewSummary = {
        available: forecast.available,
        requested: forecast.requested,
        remaining: forecast.remaining,
      };
    }

    if (dto.type === LeaveType.PERSONAL) {
      const maxConsec = this.calculator.maxConsecutiveCalendarDays(start, end);
      if (maxConsec > 2) {
        throw new BadRequestException('Personal leave: max 2 consecutive calendar days');
      }
      const year = calendarYear(new Date());
      const used = await this.balance.getPersonalUsed(tenantId, userId, year);
      const adj = await this.balance.safeAdjustmentSum(tenantId, userId, LeaveType.PERSONAL, year);
      const available = settings.personalDaysPerYear + adj - used;
      if (used + totalWorkingDays > settings.personalDaysPerYear + adj) {
        throw new BadRequestException('Personal leave limit exceeded');
      }
      previewSummary = {
        available,
        requested: totalWorkingDays,
        remaining: available - totalWorkingDays,
      };
      const annualOverlap = await this.prisma.leaveRequest.findFirst({
        where: {
          tenantId,
          userId,
          type: LeaveType.ANNUAL,
          status: LeaveRequestStatus.APPROVED,
          startDate: { lte: end },
          endDate: { gte: start },
        },
      });
      if (annualOverlap) {
        throw new BadRequestException('Personal leave cannot overlap approved annual leave');
      }
    }

    if (dto.type === LeaveType.PAID_ABSENCE) {
      if (!dto.paidAbsenceSubtype) {
        throw new BadRequestException('paidAbsenceSubtype is required');
      }
      const used = await this.balance.getPaidAbsenceUsed(tenantId, userId);
      const available = settings.paidAbsenceMaxDays - used;
      if (used + totalWorkingDays > settings.paidAbsenceMaxDays) {
        throw new BadRequestException('Paid absence limit exceeded');
      }
      previewSummary = {
        available,
        requested: totalWorkingDays,
        remaining: available - totalWorkingDays,
      };
      if (dto.paidAbsenceSubtype === PaidAbsenceSubtype.FAMILY_DEATH) {
        const subUsed = await this.balance.getPaidAbsenceUsedForSubtype(
          tenantId,
          userId,
          dto.paidAbsenceSubtype,
        );
        if (subUsed + totalWorkingDays > 5) {
          throw new BadRequestException('Family death paid absence max 5 days per event');
        }
      }
      if (dto.paidAbsenceSubtype === PaidAbsenceSubtype.BLOOD_DONATION) {
        const subUsed = await this.balance.getPaidAbsenceUsedForSubtype(
          tenantId,
          userId,
          dto.paidAbsenceSubtype,
        );
        if (subUsed + totalWorkingDays > 2) {
          throw new BadRequestException('Blood donation paid absence max 2 days');
        }
      }
    }

    return { start, end, entries, totalWorkingDays, previewSummary };
  }

  async preview(tenantId: string, userId: string, dto: CreateLeaveRequestDto) {
    const { entries, totalWorkingDays, previewSummary } = await this.validateRequest(
      tenantId,
      userId,
      dto,
    );
    return {
      entries,
      totalWorkingDays,
      summary: previewSummary ?? {
        available: 0,
        requested: totalWorkingDays,
        remaining: 0,
      },
    };
  }

  async create(tenantId: string, userId: string, dto: CreateLeaveRequestDto) {
    const { start, end, entries, totalWorkingDays } = await this.validateRequest(
      tenantId,
      userId,
      dto,
    );

    const req = await this.prisma.leaveRequest.create({
      data: {
        tenantId,
        userId,
        type: dto.type,
        paidAbsenceSubtype: dto.paidAbsenceSubtype ?? null,
        status: LeaveRequestStatus.DRAFT,
        startDate: start,
        endDate: end,
        note: dto.note?.trim() || null,
        totalWorkingDays,
        dayEntries: {
          create: entries.map((e) => ({
            date: parseDateOnly(e.date),
            days: e.days,
            isWeekend: e.isWeekend,
            isHoliday: e.isHoliday,
            countsTowardBalance: e.countsTowardBalance,
          })),
        },
      },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        dayEntries: { orderBy: { date: 'asc' } },
      },
    });
    return req;
  }

  async submit(tenantId: string, userId: string, requestId: string) {
    const req = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, tenantId, userId },
      include: { user: true },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== LeaveRequestStatus.DRAFT && req.status !== LeaveRequestStatus.NEEDS_REVISION) {
      throw new BadRequestException('Request cannot be submitted');
    }

    let approverId = req.user.leaveApproverId;
    if (!approverId) {
      const settings = await this.balance.getOrCreateSettings(tenantId);
      approverId = settings.defaultApproverId;
    }
    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: LeaveRequestStatus.PENDING,
        approverId,
        submittedAt: new Date(),
      },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        approver: { select: { id: true, email: true, displayName: true } },
      },
    });

    if (approverId) {
      await this.email.notifyApprover(tenantId, updated);
    }
    return updated;
  }

  private async assertCanDecide(
    _tenantId: string,
    actor: { userId: string; role: string },
    request: { userId: string; approverId: string | null },
  ) {
    if (!request.approverId || request.approverId !== actor.userId) {
      throw new ForbiddenException('Only the assigned approver can decide this request');
    }
  }

  async approve(
    tenantId: string,
    actor: { userId: string; role: string },
    requestId: string,
    dto: LeaveDecisionDto,
  ) {
    const req = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, tenantId },
      include: { user: true },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }
    await this.assertCanDecide(tenantId, actor, req);

    let entitlementId: string | null = null;
    if (req.type === LeaveType.ANNUAL) {
      const forecast = await this.balance.forecastAnnual(
        tenantId,
        req.userId,
        req.totalWorkingDays,
      );
      if (forecast.remaining < 0) {
        throw new BadRequestException('Insufficient annual leave balance');
      }
      const buckets = await this.balance.getAnnualBalances(tenantId, req.userId);
      entitlementId = buckets[0]?.id ?? null;
      await this.balance.consumeAnnualLeaveDays(
        tenantId,
        req.userId,
        req.totalWorkingDays,
        actor.userId,
      );
    }

    const settings = await this.balance.getOrCreateSettings(tenantId);
    const year = new Date().getFullYear();
    let decisionNumber: string | null = null;
    if (req.type === LeaveType.ANNUAL) {
      const seq =
        settings.decisionSeqYear === year
          ? settings.decisionSeqCounter + 1
          : 1;
      decisionNumber = `GO-${year}-${String(seq).padStart(4, '0')}`;
      await this.prisma.tenantLeaveSettings.update({
        where: { tenantId },
        data: { decisionSeqYear: year, decisionSeqCounter: seq },
      });
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: LeaveRequestStatus.APPROVED,
        decidedAt: new Date(),
        decisionNote: dto.decisionNote?.trim() || null,
        entitlementId,
        decisionNumber,
      },
      include: {
        user: true,
        approver: { select: { id: true, displayName: true, jobTitle: true } },
        dayEntries: { orderBy: { date: 'asc' } },
      },
    });

    if (req.type === LeaveType.ANNUAL) {
      const doc = await this.documents.generateDecision(tenantId, updated);
      if (doc) {
        await this.prisma.leaveRequest.update({
          where: { id: requestId },
          data: { documentPath: doc.relativePath },
        });
        updated.documentPath = doc.relativePath;
        await this.email.sendDecisionDocument(tenantId, updated, {
          filename: doc.filename,
          content: doc.docxBuffer,
        });
      }
    }

    await this.email.notifyEmployeeDecision(tenantId, updated, 'approved');
    return updated;
  }

  async reject(
    tenantId: string,
    actor: { userId: string; role: string },
    requestId: string,
    dto: LeaveDecisionDto,
  ) {
    if (!dto.decisionNote?.trim()) {
      throw new BadRequestException('decisionNote is required for rejection');
    }
    const req = await this.prisma.leaveRequest.findFirst({ where: { id: requestId, tenantId } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }
    await this.assertCanDecide(tenantId, actor, req);

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: LeaveRequestStatus.REJECTED,
        decidedAt: new Date(),
        decisionNote: dto.decisionNote.trim(),
      },
      include: { user: true },
    });
    await this.email.notifyEmployeeDecision(tenantId, updated, 'rejected');
    return updated;
  }

  async cancel(tenantId: string, userId: string, requestId: string) {
    const req = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, tenantId },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        approver: { select: { id: true, email: true, displayName: true } },
      },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.userId !== userId) {
      throw new ForbiddenException('Only the request owner can cancel');
    }

    const cancellable: LeaveRequestStatus[] = [
      LeaveRequestStatus.PENDING,
      LeaveRequestStatus.NEEDS_REVISION,
      LeaveRequestStatus.APPROVED,
    ];
    if (!cancellable.includes(req.status)) {
      throw new BadRequestException('Request cannot be cancelled');
    }

    if (req.status === LeaveRequestStatus.APPROVED) {
      const today = parseDateOnly(new Date());
      const start = parseDateOnly(req.startDate);
      if (start <= today) {
        throw new BadRequestException('Cannot cancel leave that has already started');
      }
      if (req.type === LeaveType.ANNUAL) {
        await this.balance.restoreAnnualLeaveDays(
          tenantId,
          userId,
          req.totalWorkingDays,
          userId,
        );
      }
    }

    const wasPending = req.status === LeaveRequestStatus.PENDING;

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: LeaveRequestStatus.CANCELLED,
        decidedAt: new Date(),
        decisionNote: 'Otkazano od strane zaposlenog',
      },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        approver: { select: { id: true, email: true, displayName: true } },
      },
    });

    if (wasPending && updated.approver) {
      await this.email.notifyApproverCancelled(tenantId, updated);
    }

    return updated;
  }

  async needsRevision(
    tenantId: string,
    actor: { userId: string; role: string },
    requestId: string,
    dto: LeaveDecisionDto,
  ) {
    const req = await this.prisma.leaveRequest.findFirst({ where: { id: requestId, tenantId } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }
    await this.assertCanDecide(tenantId, actor, req);

    return this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: LeaveRequestStatus.NEEDS_REVISION,
        decidedAt: new Date(),
        decisionNote: dto.decisionNote?.trim() || null,
      },
      include: { user: true },
    });
  }

  async listRequests(
    tenantId: string,
    actor: { userId: string; role: string },
    filters?: { status?: LeaveRequestStatus; scope?: 'my' | 'pending-approvals' },
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (filters?.scope === 'pending-approvals') {
      where.status = LeaveRequestStatus.PENDING;
      where.approverId = actor.userId;
    } else if (filters?.scope === 'my' || actor.role !== 'SUPER_ADMIN') {
      where.userId = actor.userId;
    }
    if (filters?.status) where.status = filters.status;

    return this.prisma.leaveRequest.findMany({
      where: where as never,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        approver: { select: { id: true, email: true, displayName: true } },
      },
    });
  }

  async getRequest(tenantId: string, actor: { userId: string; role: string }, id: string) {
    const req = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        approver: { select: { id: true, email: true, displayName: true } },
        dayEntries: { orderBy: { date: 'asc' } },
      },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (
      actor.role !== 'SUPER_ADMIN' &&
      req.userId !== actor.userId &&
      req.approverId !== actor.userId
    ) {
      const isMgr = await this.prisma.user.count({
        where: { tenantId, id: req.userId, leaveApproverId: actor.userId },
      });
      if (!isMgr) throw new ForbiddenException('Access denied');
    }
    return req;
  }

  async timeline(
    tenantId: string,
    actor: { userId: string; role: string },
    query: { month?: string; scope?: 'company' | 'my'; userId?: string },
  ) {
    const monthStr = query.month ?? formatDateOnly(new Date()).slice(0, 7);
    const [y, m] = monthStr.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);

    const userWhere: Record<string, unknown> = { tenantId, isActive: true };
    if (query.scope === 'my') {
      userWhere.id = actor.userId;
    } else if (query.userId) {
      userWhere.id = query.userId;
    }

    const users = await this.prisma.user.findMany({
      where: userWhere as never,
      select: { id: true, email: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });

    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        userId: { in: users.map((u) => u.id) },
        status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: {
        dayEntries: true,
        user: { select: { id: true, email: true, displayName: true } },
      },
    });

    const holidays = await this.prisma.publicHoliday.findMany({
      where: { tenantId, date: { gte: start, lte: end } },
    });

    return {
      month: monthStr,
      users,
      requests: requests.map((r) => ({
        ...r,
        startDate: formatDateOnly(r.startDate),
        endDate: formatDateOnly(r.endDate),
        dayEntries: r.dayEntries.map((e) => ({
          ...e,
          date: formatDateOnly(e.date),
        })),
      })),
      holidays: holidays.map((h) => ({
        ...h,
        date: formatDateOnly(h.date),
      })),
    };
  }

  async calendar(
    tenantId: string,
    actor: { userId: string; role: string },
    query: { month?: string; scope?: 'company' | 'my' },
  ) {
    return this.timeline(tenantId, actor, query);
  }

  async balancesMe(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { employmentDate: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const settings = await this.balance.getOrCreateSettings(tenantId);
    const eligibility = this.balance.getAnnualEligibility(user);
    const annual = await this.balance.getAnnualBalances(tenantId, userId);
    const year = calendarYear(new Date());
    const personalUsed = await this.balance.getPersonalUsed(tenantId, userId, year);
    const personalAdj = await this.balance.safeAdjustmentSum(
      tenantId,
      userId,
      'PERSONAL' as never,
      year,
    );
    const annualAdj = await this.balance.safeAdjustmentSum(
      tenantId,
      userId,
      'ANNUAL' as never,
      year,
    );
    const paidUsed = await this.balance.getPaidAbsenceUsed(tenantId, userId);

    const annualAvailable =
      annual.reduce((s, b) => s + b.availableDays, 0) + annualAdj;

    return {
      annualEligibility: {
        eligible: eligibility.eligible,
        eligibleFrom: formatDateOnly(eligibility.eligibleFrom),
        missingEmploymentDate: eligibility.missingEmploymentDate,
        message: eligibility.eligible ? null : this.balance.annualEligibilityMessage(user),
      },
      annual,
      annualAdjustment: annualAdj,
      annualAvailable: Math.max(0, annualAvailable),
      personal: {
        total: settings.personalDaysPerYear + personalAdj,
        used: personalUsed,
        available: Math.max(0, settings.personalDaysPerYear + personalAdj - personalUsed),
      },
      paidAbsence: {
        total: settings.paidAbsenceMaxDays,
        used: paidUsed,
        available: Math.max(0, settings.paidAbsenceMaxDays - paidUsed),
      },
    };
  }

  async reminders(tenantId: string, userId: string) {
    const settings = await this.balance.getOrCreateSettings(tenantId);
    const [mm, dd] = settings.reminderAfterMonthDay.split('-').map(Number);
    const now = new Date();
    const threshold = new Date(now.getFullYear(), mm - 1, dd);
    if (now < threshold) {
      return { showUnusedPreviousLeaveBanner: false };
    }

    await this.balance.ensureEntitlements(tenantId, userId);
    const previous = await this.prisma.leaveEntitlement.findFirst({
      where: {
        tenantId,
        userId,
        kind: 'PREVIOUS',
        expiresAt: { gte: now },
      },
    });
    if (!previous) return { showUnusedPreviousLeaveBanner: false };
    const available = previous.totalDays - previous.usedDays;
    return {
      showUnusedPreviousLeaveBanner: available > 0,
      unusedDays: available,
      expiresAt: previous.expiresAt,
    };
  }

  async notifications(tenantId: string, userId: string) {
    const today = parseDateOnly(new Date());

    const pendingApprovals = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        approverId: userId,
        status: LeaveRequestStatus.PENDING,
      },
      orderBy: { submittedAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
      },
    });

    const myActiveRequests = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        userId,
        OR: [
          {
            status: {
              in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.NEEDS_REVISION],
            },
          },
          {
            status: LeaveRequestStatus.APPROVED,
            startDate: { gt: today },
          },
        ],
      },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        approver: { select: { id: true, displayName: true, email: true } },
      },
    });

    const unreadDecisions = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        userId,
        status: {
          in: [
            LeaveRequestStatus.APPROVED,
            LeaveRequestStatus.REJECTED,
            LeaveRequestStatus.NEEDS_REVISION,
          ],
        },
        decidedAt: { not: null },
        employeeDecisionReadAt: null,
      },
      orderBy: { decidedAt: 'desc' },
      include: {
        approver: { select: { id: true, displayName: true, email: true } },
      },
    });

    return {
      pendingApprovals,
      myActiveRequests,
      unreadDecisions,
      pendingCount: pendingApprovals.length,
      myActiveCount: myActiveRequests.length,
      unreadCount: unreadDecisions.length,
      totalCount:
        pendingApprovals.length + myActiveRequests.length + unreadDecisions.length,
    };
  }

  async markDecisionsRead(tenantId: string, userId: string, requestIds?: string[]) {
    const where: Record<string, unknown> = {
      tenantId,
      userId,
      employeeDecisionReadAt: null,
      status: {
        in: [
          LeaveRequestStatus.APPROVED,
          LeaveRequestStatus.REJECTED,
          LeaveRequestStatus.NEEDS_REVISION,
        ],
      },
    };
    if (requestIds?.length) {
      where.id = { in: requestIds };
    }
    await this.prisma.leaveRequest.updateMany({
      where: where as never,
      data: { employeeDecisionReadAt: new Date() },
    });
    return { ok: true };
  }

  async absentToday(tenantId: string) {
    const today = parseDateOnly(new Date());
    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        status: LeaveRequestStatus.APPROVED,
        startDate: { lte: today },
        endDate: { gte: today },
      },
      orderBy: { startDate: 'asc' },
      include: {
        user: { select: { id: true, email: true, displayName: true, jobTitle: true } },
      },
    });

    const absences = requests
      .map((r) => ({
        requestId: r.id,
        userId: r.userId,
        displayName: r.user.displayName,
        email: r.user.email,
        jobTitle: r.user.jobTitle,
        type: r.type,
        startDate: formatDateOnly(parseDateOnly(r.startDate)),
        endDate: formatDateOnly(parseDateOnly(r.endDate)),
        totalWorkingDays: r.totalWorkingDays,
      }))
      .sort((a, b) =>
        (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email, 'sr'),
      );

    return { date: formatDateOnly(today), absences };
  }
}
