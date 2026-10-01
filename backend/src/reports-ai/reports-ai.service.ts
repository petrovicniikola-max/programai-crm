import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { buildTemplates, templateByKey } from './templates';
import { parsePromptToTemplate } from './reports-ai.parser';
import { formatPeriodLabel, supportsPeriodParams } from './report-date-utils';
import type { ReportTableResult } from './templates/types';
import ExcelJS from 'exceljs';
import { FormShareService } from '../forms/form-share.service';
import { generateSqlFromPrompt } from './llm/openai';

function escapeCsv(val: string): string {
  if (/[,"\r\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

function asRecipientsJson(emails: string[]): unknown {
  return emails
    .map((e) => String(e).trim())
    .filter((e) => e.length > 0);
}

function parseTimeHHmm(time?: string): { hour: number; minute: number } {
  const t = (time ?? '08:00').trim();
  const m = t.match(/^(\d{2}):(\d{2})$/);
  if (!m) return { hour: 8, minute: 0 };
  const hour = Math.min(23, Math.max(0, Number(m[1])));
  const minute = Math.min(59, Math.max(0, Number(m[2])));
  return { hour, minute };
}

function computeNextRunAt(
  now: Date,
  scheduleType:
    | 'DAILY'
    | 'EVERY_7_DAYS'
    | 'EVERY_15_DAYS'
    | 'MONTHLY_FIRST_DAY'
    | 'MONTHLY_LAST_DAY',
  scheduleTime?: string,
): Date {
  const { hour, minute } = parseTimeHHmm(scheduleTime);
  const base = new Date(now);
  base.setSeconds(0, 0);

  const atTime = (d: Date) => {
    const x = new Date(d);
    x.setHours(hour, minute, 0, 0);
    return x;
  };

  const nextDay = (daysToAdd: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + daysToAdd);
    return atTime(d);
  };

  if (scheduleType === 'DAILY') {
    const today = atTime(base);
    return today > base ? today : nextDay(1);
  }
  if (scheduleType === 'EVERY_7_DAYS') {
    return nextDay(7);
  }
  if (scheduleType === 'EVERY_15_DAYS') {
    return nextDay(15);
  }

  const year = base.getFullYear();
  const month = base.getMonth();
  if (scheduleType === 'MONTHLY_FIRST_DAY') {
    const first = atTime(new Date(year, month, 1));
    if (first > base) return first;
    return atTime(new Date(year, month + 1, 1));
  }

  // MONTHLY_LAST_DAY
  const last = atTime(new Date(year, month + 1, 0));
  if (last > base) return last;
  return atTime(new Date(year, month + 2, 0));
}

@Injectable()
export class ReportsAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formShareService: FormShareService,
    private readonly config: ConfigService,
  ) {}

  async generate(tenantId: string, promptText: string) {
    const parsed = parsePromptToTemplate(promptText);
    if (parsed.ok) {
      const report = await this.prisma.aiReport.create({
        data: {
          tenantId,
          title: parsed.title,
          promptText,
          mode: 'TEMPLATE',
          templateKey: parsed.templateKey,
          params: parsed.params as unknown as any,
        },
      });
      return { report, confidence: parsed.confidence };
    }

    // SQL mode fallback (requires OPENAI_API_KEY)
    const apiKey = this.config.get<string>('OPENAI_API_KEY') || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new BadRequestException(parsed.message);
    }

    const schemaSummary =
      'Tables:\n' +
      '- Company(id, tenantId, name, pib, mb)\n' +
      '- User(id, tenantId, email, companyId, role, isActive)\n' +
      '- Distributor(id, tenantId, name)\n' +
      '- Device(id, tenantId, companyId, distributorId, status)\n' +
      '- Licence(id, tenantId, companyId, deviceId, status, createdAt, validTo)\n' +
      '- Project(id, tenantId, name, startDate, endDate)\n' +
      '- ProjectAssignment(id, tenantId, projectId, userId)\n' +
      '- ProjectWorkOrder(id, tenantId, projectId, userId, title, description, hours, workDate, createdAt)\n' +
      '- SalesDistributorEmailRow(id, tenantId, mb, pib, companyName, email, createdAt)\n' +
      '- SalesDirectoryRow(id, tenantId, mb, pib, companyName, email, createdAt)\n' +
      '- AuditLog(id, tenantId, actorUserId, action, createdAt)\n';

    const llm = await generateSqlFromPrompt({
      apiKey,
      schemaSummary,
      promptText,
    });

    const report = await this.prisma.aiReport.create({
      data: {
        tenantId,
        title: llm.title,
        promptText,
        mode: 'SQL',
        templateKey: 'sql',
        sqlText: llm.sql,
      },
    });
    return { report, confidence: 0.7 };
  }

  async list(tenantId: string) {
    return this.prisma.aiReport.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { schedules: true },
    });
  }

  private validateSql(sql: string) {
    const s = sql
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
    const lower = s.toLowerCase();
    if (!/^(with|select)\b/.test(lower)) throw new BadRequestException('SQL mora biti SELECT.');
    if (/[;]+/.test(s)) throw new BadRequestException('SQL ne sme imati ;');
    const forbidden = ['insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate', 'grant', 'revoke'];
    if (forbidden.some((k) => lower.includes(k))) throw new BadRequestException('SQL sadrži nedozvoljene operacije.');
    if (!s.includes('{{tenantId}}')) throw new BadRequestException('SQL mora sadržati {{tenantId}} filter.');
    return s;
  }

  private async runSql(tenantId: string, sql: string): Promise<ReportTableResult> {
    const safeSql = this.validateSql(sql);
    const withLimit = /limit\s+\d+/i.test(safeSql) ? safeSql : `${safeSql}\nLIMIT 1000`;
    const finalSql = withLimit.replaceAll('{{tenantId}}', '$1');

    const rows = (await this.prisma.$queryRawUnsafe(finalSql, tenantId)) as Record<
      string,
      any
    >[];
    const columns = rows.length
      ? Object.keys(rows[0]!).map((k) => ({ key: k, label: k }))
      : [];
    return {
      title: 'SQL izveštaj',
      columns,
      rows: rows.map((r) => r as any),
      meta: { rowCount: rows.length },
    };
  }

  private async runReport(tenantId: string, reportId: string): Promise<ReportTableResult> {
    const report = await this.prisma.aiReport.findFirst({
      where: { id: reportId, tenantId },
    });
    if (!report) throw new NotFoundException('Izveštaj nije pronađen.');

    if (report.mode === 'SQL') {
      const sqlText = report.sqlText?.trim();
      if (!sqlText) throw new BadRequestException('SQL nije sačuvan za ovaj izveštaj.');
      const table = await this.runSql(tenantId, sqlText);
      return { ...table, title: report.title || table.title };
    }

    const templates = buildTemplates(this.prisma);
    const tpl = templateByKey(templates, report.templateKey);
    if (!tpl) throw new BadRequestException('Nepoznat tip izveštaja.');

    return tpl.run({ tenantId, now: new Date() }, (report.params as any) ?? {});
  }

  async preview(tenantId: string, reportId: string) {
    return this.runReport(tenantId, reportId);
  }

  async updatePeriodParams(
    tenantId: string,
    reportId: string,
    dto: { year?: number; month?: number | null },
  ) {
    const report = await this.prisma.aiReport.findFirst({
      where: { id: reportId, tenantId },
    });
    if (!report) throw new NotFoundException('Izveštaj nije pronađen.');
    if (report.mode !== 'TEMPLATE') {
      throw new BadRequestException('Period se može menjati samo za template izveštaje.');
    }

    const current = ((report.params as Record<string, unknown>) ?? {}) as Record<string, unknown>;
    if (!supportsPeriodParams(current)) {
      throw new BadRequestException('Ovaj izveštaj ne podržava promenu godine/meseca.');
    }

    const next: Record<string, unknown> = { ...current };
    if (dto.year != null) next.year = dto.year;
    if (dto.month === null) delete next.month;
    else if (dto.month != null) next.month = dto.month;

    const year = next.year != null ? Number(next.year) : undefined;
    const month = next.month != null ? Number(next.month) : undefined;
    const periodLabel = formatPeriodLabel(year, month);
    const baseTitle = report.title.split(' – ')[0]?.trim() || report.title;

    return this.prisma.aiReport.update({
      where: { id: reportId },
      data: {
        params: next as any,
        title: `${baseTitle} – ${periodLabel}`,
      },
    });
  }

  async export(tenantId: string, reportId: string, format: 'csv' | 'xlsx') {
    const data = await this.runReport(tenantId, reportId);
    if (format === 'csv') {
      const header = data.columns.map((c) => escapeCsv(c.label)).join(',');
      const lines = data.rows.map((r) =>
        data.columns
          .map((c) => {
            const v = r[c.key];
            const s = v == null ? '' : String(v);
            return escapeCsv(s);
          })
          .join(','),
      );
      return [header, ...lines].join('\r\n');
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Izveštaj');
    ws.addRow(data.columns.map((c) => c.label));
    data.rows.forEach((r) => {
      ws.addRow(data.columns.map((c) => (r[c.key] ?? '') as any));
    });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async createSchedule(
    tenantId: string,
    reportId: string,
    dto: {
      recipients: string[];
      scheduleType:
        | 'DAILY'
        | 'EVERY_7_DAYS'
        | 'EVERY_15_DAYS'
        | 'MONTHLY_FIRST_DAY'
        | 'MONTHLY_LAST_DAY';
      scheduleTime?: string;
      isActive?: boolean;
    },
  ) {
    const report = await this.prisma.aiReport.findFirst({
      where: { id: reportId, tenantId },
    });
    if (!report) throw new NotFoundException('Izveštaj nije pronađen.');

    const recipients = asRecipientsJson(dto.recipients);
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new BadRequestException('Bar jedan email je obavezan.');
    }

    const nextRunAt = computeNextRunAt(new Date(), dto.scheduleType, dto.scheduleTime);
    return this.prisma.aiReportSchedule.create({
      data: {
        tenantId,
        aiReportId: reportId,
        recipients: recipients as any,
        scheduleType: dto.scheduleType as any,
        scheduleTime: dto.scheduleTime ?? '08:00',
        isActive: dto.isActive ?? true,
        nextRunAt,
      },
    });
  }

  async listSchedules(tenantId: string, reportId: string) {
    return this.prisma.aiReportSchedule.findMany({
      where: { tenantId, aiReportId: reportId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async runScheduledOnce(tenantId: string, scheduleId: string) {
    const schedule = await this.prisma.aiReportSchedule.findFirst({
      where: { id: scheduleId, tenantId },
      include: { aiReport: true },
    });
    if (!schedule) throw new NotFoundException('Schedule nije pronađen.');

    const recipients = Array.isArray(schedule.recipients)
      ? (schedule.recipients as any[]).map(String)
      : [];
    if (recipients.length === 0) throw new BadRequestException('Nema recipients.');

    const runRow = await this.prisma.aiReportRun.create({
      data: {
        tenantId,
        aiReportId: schedule.aiReportId,
        status: 'SUCCESS',
      },
    });

    try {
      const table = await this.runReport(tenantId, schedule.aiReportId);
      const csv = await this.export(tenantId, schedule.aiReportId, 'csv');
      const ts = new Date().toISOString().replace('T', '_').slice(0, 19).replaceAll(':', '-');
      const filename = `CRM-Estuar-${ts}.csv`;
      const subject = `AI izveštaj: ${schedule.aiReport.title}`;
      const text = `Prilog: AI izveštaj.\n\n— CRM ESTUAR`;
      const result = await this.formShareService.sendReportEmail({
        tenantId,
        to: recipients,
        subject,
        text,
        attachment: { filename, content: typeof csv === 'string' ? csv : String(csv) },
      });

      await this.prisma.aiReportRun.update({
        where: { id: runRow.id },
        data: {
          finishedAt: new Date(),
          status: result.failed === 0 ? 'SUCCESS' : 'FAILED',
          rowCount: table.rows.length,
          errorMessage: result.failed ? (result.errors ?? []).join('; ') : null,
        },
      });
      const nextRunAt = computeNextRunAt(new Date(), schedule.scheduleType as any, schedule.scheduleTime);
      await this.prisma.aiReportSchedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: new Date(), nextRunAt },
      });
      return { sent: result.sent, failed: result.failed };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.prisma.aiReportRun.update({
        where: { id: runRow.id },
        data: {
          finishedAt: new Date(),
          status: 'FAILED',
          errorMessage: msg,
        },
      });
      throw e;
    }
  }
}

