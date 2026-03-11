import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FormsService } from '../forms/forms.service';
import { FormShareService } from '../forms/form-share.service';
import { DeviceService } from '../device/device.service';
import { LicenceService } from '../licence/licence.service';
import { TicketsExportQueryDto } from './dto/tickets-export-query.dto';

export interface ReportsOverviewDto {
  ticketsByStatus: Record<string, number>;
  ticketsByType: Record<string, number>;
  activeDevices: number;
  activeLicences: number;
  expiringLicences: Record<string, number>;
  expiringLicencesDays: number[];
  companiesCount: number;
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
    });
    const notificationsDaysBefore = (settings?.notificationsDaysBefore as number[] | null) ?? [
      30, 14, 7, 1,
    ];
    const days = [...notificationsDaysBefore]
      .filter((d) => typeof d === 'number' && d >= 0)
      .sort((a, b) => b - a);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < days.length; i++) {
      const d = days[i]!;
      const prev = i < days.length - 1 ? days[i + 1]! : 0;
      const rangeStartDays = prev + 1;
      const rangeEndDays = d;
      const start = new Date(today);
      start.setDate(start.getDate() + rangeStartDays);
      start.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setDate(end.getDate() + rangeEndDays);
      end.setHours(23, 59, 59, 999);
      const count = await this.prisma.licence.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          validTo: { gte: start, lte: end },
        },
      });
      result[String(d)] = count;
    }
    return { expiringLicences: result, expiringLicencesDays: days };
  }

  async getTicketsCsv(tenantId: string, q: TicketsExportQueryDto): Promise<string> {
    const where: Prisma.TicketWhereInput = { tenantId };
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;
    if (q.assigneeId === 'unassigned') where.assigneeId = null;
    else if (q.assigneeId) where.assigneeId = q.assigneeId;
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

    const header =
      'id,key,title,status,type,companyId,contactId,assigneeId,createdAt,updatedAt,callOccurredAt,callDurationMinutes';
    const lines = rows.map(
      (r) =>
        `${r.id},${escapeCsv(r.key)},${escapeCsv(r.title)},${r.status},${r.type},${r.companyId ?? ''},${r.contactId ?? ''},${r.assigneeId ?? ''},${r.createdAt.toISOString()},${r.updatedAt.toISOString()},${r.callOccurredAt?.toISOString() ?? ''},${r.callDurationMinutes ?? ''}`,
    );
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
    const reportSchedule = (s?.reportSchedule as 'none' | 'daily' | 'weekly') ?? 'none';
    const reportEmails = Array.isArray(s?.reportEmails) ? (s.reportEmails as string[]) : [];
    return {
      notificationsDaysBefore: daysBefore,
      reportSchedule,
      reportEmails,
    };
  }

  async patchAlertsConfig(
    tenantId: string,
    dto: { reportSchedule?: 'none' | 'daily' | 'weekly'; reportEmails?: string[] },
  ) {
    const update: { reportSchedule?: string; reportEmails?: string[] } = {};
    if (dto.reportSchedule !== undefined) update.reportSchedule = dto.reportSchedule;
    if (dto.reportEmails !== undefined) {
      update.reportEmails = dto.reportEmails.filter((e) => typeof e === 'string' && e.trim().length > 0);
    }
    await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...update },
      update,
    });
    return this.getAlertsConfig(tenantId);
  }

  async executeReport(
    tenantId: string,
    reportType: 'tickets' | 'devices' | 'licences',
    daysBack: number,
  ): Promise<{ sent: number; failed: number; message: string }> {
    const config = await this.getAlertsConfig(tenantId);
    const emails = Array.isArray(config.reportEmails) ? config.reportEmails : [];
    if (emails.length === 0) {
      return { sent: 0, failed: 0, message: 'Nema sačuvanih email adresa. Dodajte adrese i sačuvajte.' };
    }

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - daysBack);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const fromIso = start.toISOString();
    const toIso = end.toISOString();

    let csv: string;
    let filename: string;
    const dateStr = new Date().toISOString().slice(0, 10);

    if (reportType === 'tickets') {
      csv = await this.getTicketsCsv(tenantId, {
        updatedAtFrom: fromIso,
        updatedAtTo: toIso,
      });
      filename = `izvestaj_tiketi_${dateStr}.csv`;
    } else if (reportType === 'devices') {
      csv = await this.deviceService.exportCsv(tenantId, {
        createdAtFrom: fromIso,
        createdAtTo: toIso,
      });
      filename = `izvestaj_uredjaji_${dateStr}.csv`;
    } else {
      csv = await this.licenceService.exportCsv(tenantId, {});
      filename = `izvestaj_licence_${dateStr}.csv`;
    }

    const typeLabel =
      reportType === 'tickets' ? 'Tiketi' : reportType === 'devices' ? 'Uređaji' : 'Licence';
    const subject = `Izveštaj: ${typeLabel} (${daysBack} dana unazad)`;
    const text = `Prilog: izveštaj za period ${start.toLocaleDateString()} – ${end.toLocaleDateString()}.\n\n— ProgramAI`;

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
