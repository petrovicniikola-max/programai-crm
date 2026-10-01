import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FormsService } from '../forms/forms.service';
import { FormShareService } from '../forms/form-share.service';
import { DeviceService } from '../device/device.service';
import { LicenceService } from '../licence/licence.service';
import { TicketsExportQueryDto } from './dto/tickets-export-query.dto';
import { SalesExportQueryDto } from './dto/sales-export-query.dto';
import type { ReportEmailConfigItem } from './dto/alerts-config.dto';
import type { AdminDashboardDto, AdminDashboardSlice } from './admin-dashboard.types';

export interface ReportsOverviewDto {
  ticketsByStatus: Record<string, number>;
  ticketsByType: Record<string, number>;
  activeDevices: number;
  activeLicences: number;
  expiringLicences: Record<string, number>;
  expiringLicencesDays: number[];
  companiesCount: number;
}

const REPORT_TZ = 'Europe/Belgrade';

/** Start (00:00:00.000) and end (23:59:59.999) of the given calendar day in REPORT_TZ, as UTC Date. */
function getDayBoundsInTz(date: Date): { start: Date; end: Date } {
  const y = parseInt(
    date.toLocaleString('en-CA', { timeZone: REPORT_TZ, year: 'numeric' }),
    10,
  );
  const m =
    parseInt(
      date.toLocaleString('en-CA', { timeZone: REPORT_TZ, month: '2-digit' }),
      10,
    ) - 1;
  const d = parseInt(
    date.toLocaleString('en-CA', { timeZone: REPORT_TZ, day: '2-digit' }),
    10,
  );
  const noonUtc = new Date(Date.UTC(y, m, d, 12, 0, 0, 0));
  const tzHour = parseInt(
    noonUtc.toLocaleString('en-US', {
      timeZone: REPORT_TZ,
      hour: 'numeric',
      hour12: false,
    }),
    10,
  );
  const offsetHours = tzHour - 12;
  const startUtc = Date.UTC(y, m, d, 0, 0, 0, 0) - offsetHours * 3600 * 1000;
  const start = new Date(startUtc);
  const end = new Date(startUtc + 24 * 3600 * 1000 - 1);
  return { start, end };
}

function escapeCsv(val: string): string {
  if (/[,"\r\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formsService: FormsService,
    private readonly formShareService: FormShareService,
    private readonly deviceService: DeviceService,
    private readonly licenceService: LicenceService,
  ) {}

  async getOverview(tenantId: string): Promise<ReportsOverviewDto> {
    const [byStatus, byType, activeDevices, activeLicences, companiesCount, expiringData] =
      await Promise.all([
        this.prisma.ticket.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { id: true },
        }),
        this.prisma.ticket.groupBy({
          by: ['type'],
          where: { tenantId },
          _count: { id: true },
        }),
        this.prisma.device.count({
          where: { tenantId, status: 'ACTIVE' },
        }),
        this.prisma.licence.count({
          where: { tenantId, status: 'ACTIVE' },
        }),
        this.prisma.company.count({
          where: { tenantId },
        }),
        this.getExpiringLicences(tenantId),
      ]);

    const ticketsByStatus: Record<string, number> = {};
    for (const row of byStatus) {
      ticketsByStatus[row.status] = row._count.id;
    }
    const ticketsByType: Record<string, number> = {};
    for (const row of byType) {
      ticketsByType[row.type] = row._count.id;
    }

    return {
      ticketsByStatus,
      ticketsByType,
      activeDevices,
      activeLicences,
      expiringLicences: expiringData.expiringLicences,
      expiringLicencesDays: expiringData.expiringLicencesDays,
      companiesCount,
    };
  }

  private async getExpiringLicences(
    tenantId: string,
  ): Promise<{ expiringLicences: Record<string, number>; expiringLicencesDays: number[] }> {
    const result: Record<string, number> = {};
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { notificationsDaysBefore: true },
    });
    const notificationsDaysBefore = (settings?.notificationsDaysBefore as number[] | null) ?? [
      30, 14, 7, 1,
    ];
    const days = [...notificationsDaysBefore]
      .filter((d) => typeof d === 'number' && d >= 0)
      .sort((a, b) => b - a);
    if (days.length === 0) {
      return { expiringLicences: result, expiringLicencesDays: days };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDay = days[0]!;
    const rangeEnd = new Date(today);
    rangeEnd.setDate(rangeEnd.getDate() + maxDay);
    rangeEnd.setHours(23, 59, 59, 999);
    const licences = await this.prisma.licence.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        validTo: { gte: today, lte: rangeEnd },
      },
      select: { validTo: true },
    });
    for (let i = 0; i < days.length; i++) {
      const d = days[i]!;
      const prev = i < days.length - 1 ? days[i + 1]! : 0;
      const rangeStartDays = prev + 1;
      const rangeEndDays = d;
      let count = 0;
      for (const lic of licences) {
        const validTo = new Date(lic.validTo);
        validTo.setHours(0, 0, 0, 0);
        const daysUntil = Math.round(
          (validTo.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
        );
        if (daysUntil >= rangeStartDays && daysUntil <= rangeEndDays) count++;
      }
      result[String(d)] = count;
    }
    return { expiringLicences: result, expiringLicencesDays: days };
  }

  async getAdminDashboard(tenantId: string): Promise<AdminDashboardDto> {
    const now = new Date();
    const since48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const [
      companies,
      distributors,
      activeDevices,
      activeLicences,
      expiredLicences,
      ticketsOpen,
      devices,
      licencedPairs,
      packagesGrouped,
    ] = await Promise.all([
      this.prisma.company.count({ where: { tenantId } }),
      this.prisma.distributor.count({ where: { tenantId } }),
      this.prisma.device.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.licence.count({
        where: { tenantId, status: 'ACTIVE', validTo: { gte: now } },
      }),
      this.prisma.licence.count({ where: { tenantId, status: 'EXPIRED' } }),
      this.prisma.ticket.count({
        where: { tenantId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      this.prisma.device.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: {
          id: true,
          model: true,
          companyId: true,
          distributorId: true,
          sufEnvironment: true,
          updatedAt: true,
          distributor: { select: { name: true } },
        },
      }),
      this.prisma.licence.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          validTo: { gte: now },
          deviceId: { not: null },
        },
        select: { deviceId: true },
        distinct: ['deviceId'],
      }),
      this.prisma.licence.groupBy({
        by: ['productName'],
        where: { tenantId, status: 'ACTIVE', validTo: { gte: now } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 50,
      }),
    ]);

    const licencedDeviceIds = new Set(
      licencedPairs.map((l) => l.deviceId).filter((id): id is string => id != null),
    );

    const distributorCounts = new Map<string, number>();
    const modelCounts = new Map<string, number>();
    const deviceModelRows = new Map<
      string,
      {
        total: number;
        assigned: number;
        available: number;
        withDistributor: number;
        activeLicence: number;
        updated48h: number;
      }
    >();
    let withLicence = 0;
    let withoutLicence = 0;
    let sufProduction = 0;
    let sufTest = 0;
    let sufUnknown = 0;

    for (const d of devices) {
      const model = d.model?.trim() || '(nepoznat model)';
      const distLabel = d.distributor?.name?.trim() || '(bez distributera)';
      distributorCounts.set(distLabel, (distributorCounts.get(distLabel) ?? 0) + 1);
      modelCounts.set(model, (modelCounts.get(model) ?? 0) + 1);

      const row = deviceModelRows.get(model) ?? {
        total: 0,
        assigned: 0,
        available: 0,
        withDistributor: 0,
        activeLicence: 0,
        updated48h: 0,
      };
      row.total += 1;
      if (d.companyId) row.assigned += 1;
      else row.available += 1;
      if (d.distributorId) row.withDistributor += 1;
      if (licencedDeviceIds.has(d.id)) row.activeLicence += 1;
      if (d.updatedAt >= since48h) row.updated48h += 1;
      deviceModelRows.set(model, row);

      if (licencedDeviceIds.has(d.id)) withLicence += 1;
      else withoutLicence += 1;

      const suf = (d.sufEnvironment ?? '').toLowerCase();
      if (suf === 'produkciono') sufProduction += 1;
      else if (suf === 'test') sufTest += 1;
      else sufUnknown += 1;
    }

    const toSlices = (map: Map<string, number>, limit = 8): AdminDashboardSlice[] =>
      Array.from(map.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);

    const devicesByModel = Array.from(deviceModelRows.entries())
      .map(([model, row]) => ({ model, ...row }))
      .sort((a, b) => b.total - a.total);

    const devicesTotals = devicesByModel.reduce(
      (acc, row) => ({
        total: acc.total + row.total,
        assigned: acc.assigned + row.assigned,
        available: acc.available + row.available,
        withDistributor: acc.withDistributor + row.withDistributor,
        activeLicence: acc.activeLicence + row.activeLicence,
        updated48h: acc.updated48h + row.updated48h,
      }),
      {
        total: 0,
        assigned: 0,
        available: 0,
        withDistributor: 0,
        activeLicence: 0,
        updated48h: 0,
      },
    );

    return {
      generatedAt: now.toISOString(),
      summary: {
        companies,
        distributors,
        activeDevices,
        activeLicences,
        expiredLicences,
        ticketsOpen,
      },
      byDistributor: toSlices(distributorCounts),
      byModel: toSlices(modelCounts),
      licenceCoverage: [
        { label: 'Sa aktivnom licencom', value: withLicence },
        { label: 'Bez aktivne licence', value: withoutLicence },
      ],
      sufProduction: [
        { label: 'SUF produkciono', value: sufProduction },
        { label: 'SUF test', value: sufTest },
        { label: 'SUF nepoznato', value: sufUnknown },
      ].filter((s) => s.value > 0),
      activePackages: packagesGrouped.map((p) => ({
        productName: p.productName,
        total: p._count.id,
      })),
      devicesByModel: [
        ...devicesByModel,
        {
          model: '__UKUPNO__',
          ...devicesTotals,
        },
      ],
    };
  }

  async getTicketsCsv(tenantId: string, q: TicketsExportQueryDto): Promise<string> {
    const where: Prisma.TicketWhereInput = { tenantId };
    if (q.statuses?.length) where.status = { in: q.statuses };
    else if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;
    if (q.assigneeId === 'unassigned') where.assigneeId = null;
    else if (q.assigneeId) where.assigneeId = q.assigneeId;
    if (q.createdByUserId) where.createdByUserId = q.createdByUserId;
    if (q.companyId) where.companyId = q.companyId;
    if (q.createdAtFrom || q.createdAtTo) {
      where.createdAt = {};
      if (q.createdAtFrom) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(q.createdAtFrom);
      if (q.createdAtTo) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(q.createdAtTo);
    }
    if (q.updatedAtFrom || q.updatedAtTo) {
      where.updatedAt = {};
      if (q.updatedAtFrom) (where.updatedAt as Prisma.DateTimeFilter).gte = new Date(q.updatedAtFrom);
      if (q.updatedAtTo) (where.updatedAt as Prisma.DateTimeFilter).lte = new Date(q.updatedAtTo);
    }

    const rows = await this.prisma.ticket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 10000,
    });

    const createdRange =
      q.createdAtFrom || q.createdAtTo ? `${q.createdAtFrom ?? '...'} -> ${q.createdAtTo ?? '...'}` : 'none';
    const updatedRange =
      q.updatedAtFrom || q.updatedAtTo ? `${q.updatedAtFrom ?? '...'} -> ${q.updatedAtTo ?? '...'}` : 'none';
    // eslint-disable-next-line no-console
    console.log(
      `[TicketsCsv] tenant=${tenantId} createdAt=${createdRange} updatedAt=${updatedRange} count=${rows.length}`,
    );

    const header =
      'id,key,title,status,type,companyId,contactId,assigneeId,createdAt,updatedAt,callOccurredAt,callDurationMinutes,contactMethod,contactsContactedCount';
    const lines = rows.map(
      (r) =>
        `${r.id},${escapeCsv(r.key)},${escapeCsv(r.title)},${r.status},${r.type},${r.companyId ?? ''},${r.contactId ?? ''},${r.assigneeId ?? ''},${r.createdAt.toISOString()},${r.updatedAt.toISOString()},${r.callOccurredAt?.toISOString() ?? ''},${r.callDurationMinutes ?? ''},${r.contactMethod ?? ''},${r.contactsContactedCount ?? ''}`,
    );
    return [header, ...lines].join('\r\n');
  }

  async getSalesCsv(tenantId: string, q: SalesExportQueryDto): Promise<string> {
    const where: Prisma.TicketWhereInput = { tenantId, key: { startsWith: 'O' } };
    if (q.createdByUserId) where.createdByUserId = q.createdByUserId;
    if (q.contactMethod) where.contactMethod = q.contactMethod;
    if (q.createdAtFrom || q.createdAtTo) {
      where.createdAt = {};
      if (q.createdAtFrom) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(q.createdAtFrom);
      if (q.createdAtTo) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(q.createdAtTo);
    }

    const rows = await this.prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
      include: {
        company: { select: { name: true } },
        createdBy: { select: { email: true, displayName: true } },
      },
    });

    const createdRange =
      q.createdAtFrom || q.createdAtTo ? `${q.createdAtFrom ?? '...'} -> ${q.createdAtTo ?? '...'}` : 'none';
    // eslint-disable-next-line no-console
    console.log(`[SalesCsv] tenant=${tenantId} createdAt=${createdRange} count=${rows.length}`);

    const header =
      'key,title,status,type,companyName,contactMethod,callOccurredAt,createdAt,createdByEmail,createdByDisplayName';
    const lines = rows.map((r) => {
      const creatorLabel = r.createdBy
        ? (r.createdBy.displayName || r.createdBy.email || '')
        : '';
      return [
        escapeCsv(r.key),
        escapeCsv(r.title),
        r.status,
        r.type,
        escapeCsv(r.company?.name ?? ''),
        r.contactMethod ?? '',
        r.callOccurredAt?.toISOString() ?? '',
        r.createdAt.toISOString(),
        escapeCsv(r.createdBy?.email ?? ''),
        escapeCsv(creatorLabel),
      ].join(',');
    });
    return [header, ...lines].join('\r\n');
  }

  async getTableCsv(tenantId: string, formId: string): Promise<string> {
    return this.formsService.getResponsesCsv(tenantId, formId, {
      limit: 5000,
      offset: 0,
      sort: 'desc',
    });
  }

  async getAlertsConfig(tenantId: string) {
    const s = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
    });
    const daysBefore = (s?.notificationsDaysBefore as number[] | null) ?? [30, 14, 7, 1];
    const reportSchedule = (s?.reportSchedule as 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly') ?? 'none';
    const reportEmails = Array.isArray(s?.reportEmails) ? (s.reportEmails as string[]) : [];
    let reportEmailConfigs = Array.isArray(s?.reportEmailConfigs) ? (s.reportEmailConfigs as unknown as ReportEmailConfigItem[]) : [];
    if (reportEmailConfigs.length === 0 && reportEmails.length > 0) {
      const schedule = reportSchedule && reportSchedule !== 'none' ? (reportSchedule as 'daily' | 'weekly' | 'monthly' | 'yearly') : 'weekly';
      reportEmailConfigs = reportEmails
        .filter((e) => typeof e === 'string' && e.trim().length > 0)
        .map((email) => ({ email: email.trim(), schedule, reportType: 'tickets' as const }));
    }
    return {
      notificationsDaysBefore: daysBefore,
      reportSchedule,
      reportEmails,
      reportEmailConfigs,
    };
  }

  async patchAlertsConfig(
    tenantId: string,
    dto: {
      reportSchedule?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
      reportEmails?: string[];
      reportEmailConfigs?: ReportEmailConfigItem[];
    },
  ) {
    let reportSchedule: string | undefined;
    let reportEmails: string[] | undefined;
    let reportEmailConfigsJson: Prisma.InputJsonValue | undefined;

    if (dto.reportSchedule !== undefined) reportSchedule = dto.reportSchedule;
    if (dto.reportEmails !== undefined) {
      reportEmails = dto.reportEmails.filter((e) => typeof e === 'string' && e.trim().length > 0);
    }
    if (dto.reportEmailConfigs !== undefined) {
      const configs = dto.reportEmailConfigs
        .filter((c) => c?.email && typeof c.email === 'string' && c.email.trim().length > 0)
        .map((c) => ({
          email: (c.email as string).trim(),
          schedule: c.schedule ?? 'weekly',
          reportType: c.reportType ?? 'tickets',
          companyId: c.companyId?.trim() || undefined,
          deviceIds: Array.isArray(c.deviceIds) ? c.deviceIds.filter((id) => typeof id === 'string') : undefined,
          ticketStatuses: Array.isArray(c.ticketStatuses) ? c.ticketStatuses : undefined,
          assigneeId: c.assigneeId?.trim() || undefined,
          salesCreatedByUserId: c.salesCreatedByUserId?.trim() || undefined,
          salesContactMethod: c.salesContactMethod || undefined,
          scheduleTime: c.scheduleTime?.trim() || undefined,
          scheduleDayOfWeek: c.scheduleDayOfWeek,
          scheduleMonthOption: c.scheduleMonthOption,
          scheduleYearOption: c.scheduleYearOption,
        }));
      reportEmailConfigsJson = configs as Prisma.InputJsonValue;
    }

    const update: Prisma.TenantSettingsUpdateInput = {};
    if (reportSchedule !== undefined) update.reportSchedule = reportSchedule;
    if (reportEmails !== undefined) update.reportEmails = reportEmails;
    if (reportEmailConfigsJson !== undefined) update.reportEmailConfigs = reportEmailConfigsJson;

    await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...(reportSchedule !== undefined && { reportSchedule }),
        ...(reportEmails !== undefined && { reportEmails }),
        ...(reportEmailConfigsJson !== undefined && { reportEmailConfigs: reportEmailConfigsJson }),
      },
      update,
    });
    return this.getAlertsConfig(tenantId);
  }

  private static daysBackFromSchedule(schedule: 'daily' | 'weekly' | 'monthly' | 'yearly'): number {
    return schedule === 'daily' ? 1 : schedule === 'weekly' ? 7 : schedule === 'monthly' ? 30 : 365;
  }

  private getDateRangeForConfig(item: ReportEmailConfigItem): { start: Date; end: Date } {
    const now = new Date();
    now.setSeconds(0, 0);
    const scheduleTime = item.scheduleTime ?? '08:00';
    const [hStr, mStr] = scheduleTime.split(':');
    const hour = Number(hStr) || 0;
    const minute = Number(mStr) || 0;
    const isEarly = hour < 4 || (hour === 4 && minute === 0); // 00:00–04:00 → prethodni dan

    if (item.schedule === 'daily') {
      const dayInTz = new Date(now);
      if (isEarly) dayInTz.setDate(dayInTz.getDate() - 1);
      return getDayBoundsInTz(dayInTz);
    }

    if (item.schedule === 'weekly') {
      const endDay = new Date(now);
      if (isEarly) endDay.setDate(endDay.getDate() - 1);
      const { end } = getDayBoundsInTz(endDay);
      const startDay = new Date(endDay);
      startDay.setDate(startDay.getDate() - 6);
      const { start } = getDayBoundsInTz(startDay);
      return { start, end };
    }

    const atStartOfDay = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    const atEndOfDay = (d: Date) => {
      const x = new Date(d);
      x.setHours(23, 59, 59, 999);
      return x;
    };

    if (item.schedule === 'monthly') {
      const year = now.getFullYear();
      const month = now.getMonth();
      const firstOfCurrentMonth = new Date(year, month, 1);
      const lastOfCurrentMonth = new Date(year, month + 1, 0);
      const firstOfPreviousMonth = new Date(year, month - 1, 1);
      const lastOfPreviousMonth = new Date(year, month, 0);

      if (item.scheduleMonthOption === '1st_previous') {
        // prethodni mesec
        return { start: atStartOfDay(firstOfPreviousMonth), end: atEndOfDay(lastOfPreviousMonth) };
      }
      // tekući mesec
      return { start: atStartOfDay(firstOfCurrentMonth), end: atEndOfDay(lastOfCurrentMonth) };
    }

    // yearly – tekuća ili prethodna godina (celi kalendarski opseg)
    const yearNow = now.getFullYear();
    const year =
      item.scheduleYearOption === 'previous'
        ? yearNow - 1
        : yearNow;
    const firstOfYear = new Date(year, 0, 1);
    const lastOfYear = new Date(year, 11, 31);
    return { start: atStartOfDay(firstOfYear), end: atEndOfDay(lastOfYear) };
  }

  private async sendOneReportForConfig(
    tenantId: string,
    item: ReportEmailConfigItem,
  ): Promise<{ sent: number; failed: number }> {
    const { start, end } = this.getDateRangeForConfig(item);
    const fromIso = start.toISOString();
    const toIso = end.toISOString();
    const dateStr = new Date().toISOString().slice(0, 10);

    let csv: string;
    let filename: string;
    if (item.reportType === 'tickets') {
      const ticketQuery: {
        createdAtFrom: string;
        createdAtTo: string;
        statuses?: ('OPEN' | 'IN_PROGRESS' | 'DONE')[];
        createdByUserId?: string;
      } = { createdAtFrom: fromIso, createdAtTo: toIso };
      if (item.ticketStatuses?.length) ticketQuery.statuses = item.ticketStatuses;
      if (item.assigneeId) ticketQuery.createdByUserId = item.assigneeId;
      csv = await this.getTicketsCsv(tenantId, ticketQuery);
      filename = `izvestaj_tiketi_${dateStr}.csv`;
    } else if (item.reportType === 'sales') {
      csv = await this.getSalesCsv(tenantId, {
        createdAtFrom: fromIso,
        createdAtTo: toIso,
        createdByUserId: item.salesCreatedByUserId?.trim() || undefined,
        contactMethod: item.salesContactMethod,
      });
      filename = `izvestaj_prodaja_${dateStr}.csv`;
    } else if (item.reportType === 'devices') {
      const deviceQuery: { createdAtFrom?: string; createdAtTo?: string; companyId?: string; ids?: string[] } = {
        createdAtFrom: fromIso,
        createdAtTo: toIso,
      };
      if (item.companyId) deviceQuery.companyId = item.companyId;
      if (item.deviceIds?.length) deviceQuery.ids = item.deviceIds;
      csv = await this.deviceService.exportCsv(tenantId, deviceQuery);
      filename = `izvestaj_uredjaji_${dateStr}.csv`;
    } else {
      const licenceQuery: { companyId?: string; deviceIds?: string[] } = {};
      if (item.companyId) licenceQuery.companyId = item.companyId;
      if (item.deviceIds?.length) licenceQuery.deviceIds = item.deviceIds;
      csv = await this.licenceService.exportCsv(tenantId, licenceQuery);
      filename = `izvestaj_licence_${dateStr}.csv`;
    }

    const rowCount = Math.max(0, csv.split(/\r?\n/).length - 1);
    // eslint-disable-next-line no-console
    console.log(`[Report] type=${item.reportType} period=${fromIso} -> ${toIso} rows=${rowCount}`);

    const typeLabel =
      item.reportType === 'tickets'
        ? 'Tiketi'
        : item.reportType === 'sales'
          ? 'Prodaja'
          : item.reportType === 'devices'
            ? 'Uređaji'
            : 'Licence';
    const subject = `Izveštaj: ${typeLabel}`;
    const text = `Prilog: izveštaj za period ${start.toLocaleDateString()} – ${end.toLocaleDateString()}.\n\n— CRM ESTUAR`;

    return this.formShareService.sendReportEmail({
      tenantId,
      to: [item.email],
      subject,
      text,
      attachment: { filename, content: csv },
    });
  }

  async executeReport(
    tenantId: string,
    dto: { executeAll?: boolean; configIndex?: number; reportType?: 'tickets' | 'devices' | 'licences'; daysBack?: number; deviceIds?: string[] },
  ): Promise<{ sent: number; failed: number; message: string }> {
    // eslint-disable-next-line no-console
    console.log(
      `[ExecuteReport] tenant=${tenantId} configIndex=${dto.configIndex} executeAll=${dto.executeAll} reportType=${dto.reportType}`,
    );
    const config = await this.getAlertsConfig(tenantId);
    const configs = config.reportEmailConfigs ?? [];

    if (dto.configIndex !== undefined && dto.configIndex >= 0) {
      const item = configs[dto.configIndex];
      if (!item?.email?.trim()) {
        return { sent: 0, failed: 0, message: 'Stavka nije pronađena ili nema email. Sačuvajte konfiguraciju pa pokušajte ponovo.' };
      }
      const result = await this.sendOneReportForConfig(tenantId, item);
      const message = result.failed === 0
        ? `Izveštaj poslat na ${item.email}.`
        : result.sent > 0 ? `Poslato na ${item.email}, ali neki primaoici nisu uspešni.` : 'Slanje nije uspelo.';
      return { sent: result.sent, failed: result.failed, message };
    }

    if (dto.executeAll) {
      if (configs.length === 0) {
        return { sent: 0, failed: 0, message: 'Nema konfiguracija. Dodajte stavke po emailu i sačuvajte.' };
      }
      let sent = 0;
      let failed = 0;
      for (const item of configs) {
        const result = await this.sendOneReportForConfig(tenantId, item);
        sent += result.sent;
        failed += result.failed;
      }
      const message =
        failed === 0
          ? `Izveštaji poslati: ${sent} emailova.`
          : `Poslato: ${sent}, nije poslato: ${failed}.`;
      return { sent, failed, message };
    }

    const reportType = dto.reportType ?? 'tickets';
    const daysBack = dto.daysBack ?? 7;
    const emails = config.reportEmails?.length ? config.reportEmails : configs.map((c) => c.email);
    if (emails.length === 0) {
      return { sent: 0, failed: 0, message: 'Nema sačuvanih email adresa. Dodajte konfiguraciju po emailu ili adrese i sačuvajte.' };
    }

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - daysBack);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const fromIso = start.toISOString();
    const toIso = end.toISOString();
    const dateStr = new Date().toISOString().slice(0, 10);

    let csv: string;
    let filename: string;
    if (reportType === 'tickets') {
      csv = await this.getTicketsCsv(tenantId, { createdAtFrom: fromIso, createdAtTo: toIso });
      filename = `izvestaj_tiketi_${dateStr}.csv`;
    } else if (reportType === 'devices') {
      const deviceQuery: { createdAtFrom?: string; createdAtTo?: string; ids?: string[] } = {
        createdAtFrom: fromIso,
        createdAtTo: toIso,
      };
      if (dto.deviceIds?.length) deviceQuery.ids = dto.deviceIds;
      csv = await this.deviceService.exportCsv(tenantId, deviceQuery);
      filename = `izvestaj_uredjaji_${dateStr}.csv`;
    } else {
      csv = await this.licenceService.exportCsv(tenantId, {});
      filename = `izvestaj_licence_${dateStr}.csv`;
    }

    const typeLabel = reportType === 'tickets' ? 'Tiketi' : reportType === 'devices' ? 'Uređaji' : 'Licence';
    const subject = `Izveštaj: ${typeLabel} (${daysBack} dana unazad)`;
    const text = `Prilog: izveštaj za period ${start.toLocaleDateString()} – ${end.toLocaleDateString()}.\n\n— CRM ESTUAR`;

    const result = await this.formShareService.sendReportEmail({
      tenantId,
      to: emails,
      subject,
      text,
      attachment: { filename, content: csv },
    });

    const message =
      result.failed === 0
        ? `Izveštaj poslat na ${result.sent} adresa.`
        : `Poslato: ${result.sent}, nije poslato: ${result.failed}.`;

    return { sent: result.sent, failed: result.failed, message };
  }
}
