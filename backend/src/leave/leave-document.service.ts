import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkingDaysCalculator } from './working-days.calculator';
import { formatDateOnly } from './leave-date.util';
import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { promises as fs } from 'fs';
import * as path from 'path';

function numberToWordsSr(n: number): string {
  const words = [
    'nula',
    'jedan',
    'dva',
    'tri',
    'četiri',
    'pet',
    'šest',
    'sedam',
    'osam',
    'devet',
    'deset',
    'jedanaest',
    'dvanaest',
    'trinaest',
    'četrnaest',
    'petnaest',
    'šesnaest',
    'sedamnaest',
    'osamnaest',
    'devetnaest',
    'dvadeset',
  ];
  const whole = Math.round(n);
  if (whole >= 0 && whole < words.length) return `${words[whole]} (${whole})`;
  return String(whole);
}

function formatWorkingDaysSr(n: number): string {
  const value = Number.isInteger(n) ? n : Math.round(n * 2) / 2;
  const int = Math.round(value);
  const words = numberToWordsSr(int);
  if (words.includes('(')) {
    const match = /\((\d+(?:\.\d+)?)\)/.exec(words);
    const num = match ? match[1] : String(value);
    return `${num} (${words.split('(')[0].trim()})`;
  }
  return String(value);
}

function formatSrDate(d: Date): string {
  return d.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export interface GeneratedDecision {
  relativePath: string;
  docxBuffer: Buffer;
  filename: string;
}

interface DecisionContext {
  title: string;
  brandLine: string;
  addressLine: string;
  decisionNumber: string;
  employeeName: string;
  workingDays: number;
  workingDaysLabel: string;
  jobTitle: string;
  employmentLine: string;
  contractLine: string;
  periodLine: string;
  returnLine: string;
  approverName: string;
  approverTitle: string;
  filename: string;
}

@Injectable()
export class LeaveDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: WorkingDaysCalculator,
  ) {}

  async generateDecision(
    tenantId: string,
    request: {
      id: string;
      userId: string;
      startDate: Date;
      endDate: Date;
      totalWorkingDays: number;
      decisionNumber: string | null;
      type: string;
    },
  ): Promise<GeneratedDecision | null> {
    if (request.type !== 'ANNUAL') return null;

    const ctx = await this.buildContext(tenantId, request);
    if (!ctx) return null;

    const html = this.renderHtml(ctx);
    const docxBuffer = await this.renderDocx(ctx);

    const dir = path.join(process.cwd(), 'uploads', 'leave', request.id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'resenje.html'), html, 'utf8');
    await fs.writeFile(path.join(dir, ctx.filename), docxBuffer);

    return {
      relativePath: `leave/${request.id}/${ctx.filename}`,
      docxBuffer,
      filename: ctx.filename,
    };
  }

  private async buildContext(
    tenantId: string,
    request: {
      id: string;
      userId: string;
      startDate: Date;
      endDate: Date;
      totalWorkingDays: number;
      decisionNumber: string | null;
    },
  ): Promise<DecisionContext | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: request.userId, tenantId },
      include: { leaveApprover: true },
    });
    if (!user) return null;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true, leaveSettings: true },
    });
    const leaveSettings = tenant?.leaveSettings;
    const branding = tenant?.settings;

    const holidays = await this.prisma.publicHoliday.findMany({ where: { tenantId } });
    const holidaySet = new Set(holidays.map((h) => formatDateOnly(new Date(h.date))));
    const returnDate = this.calculator.firstWorkingDayAfter(request.endDate, holidaySet);

    const isFixed = user.employmentContractType === 'FIXED_TERM';
    const title = isFixed
      ? 'Rešenje o korišćenju srazmernog dela godišnjeg odmora'
      : 'Rešenje o korišćenju godišnjeg odmora';

    const employeeName = user.displayName?.trim() || user.email;
    const workingDays = request.totalWorkingDays;
    const workingDaysLabel = formatWorkingDaysSr(workingDays);
    const jobTitle = user.jobTitle ?? 'zaposleni';
    const employmentLine = user.employmentDate
      ? `zaposlen od ${formatSrDate(new Date(user.employmentDate))}`
      : '';
    const contractLine =
      isFixed && user.contractEndDate
        ? `, ugovor do ${formatSrDate(new Date(user.contractEndDate))}`
        : '';

    const safeName = employeeName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
    const filename = `resenje_${safeName || 'zaposleni'}_${request.decisionNumber ?? request.id}.docx`;

    return {
      title,
      brandLine: branding?.brandName ?? tenant?.name ?? '',
      addressLine: `${leaveSettings?.companyAddress ?? ''}${
        leaveSettings?.companyCity ? `, ${leaveSettings.companyCity}` : ''
      }`.trim(),
      decisionNumber: request.decisionNumber ?? '—',
      employeeName,
      workingDays,
      workingDaysLabel,
      jobTitle,
      employmentLine,
      contractLine,
      periodLine: `${formatSrDate(new Date(request.startDate))} – ${formatSrDate(new Date(request.endDate))}`,
      returnLine: formatSrDate(returnDate),
      approverName: user.leaveApprover?.displayName ?? '—',
      approverTitle: user.leaveApprover?.jobTitle ?? '',
      filename,
    };
  }

  private renderHtml(ctx: DecisionContext): string {
    return `<!DOCTYPE html>
<html lang="sr">
<head>
  <meta charset="utf-8" />
  <title>${ctx.title}</title>
  <style>
    body { font-family: 'Times New Roman', serif; max-width: 800px; margin: 40px auto; line-height: 1.6; }
    h1 { text-align: center; font-size: 18px; }
    .meta { margin: 24px 0; }
    .signature { margin-top: 48px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <p style="text-align:right">${ctx.brandLine}</p>
  <p>${ctx.addressLine}</p>
  <h1>${ctx.title}</h1>
  <p class="meta"><strong>Broj:</strong> ${ctx.decisionNumber}</p>
  <p class="meta"><strong>Datum:</strong> ${formatSrDate(new Date())}</p>
  <p>Na osnovu Zakona o radu i Pravilnika o radu, rešava se:</p>
  <p class="meta"><strong>Zaposleni (ime i prezime):</strong> ${ctx.employeeName}</p>
  <p class="meta"><strong>Broj radnih dana godišnjeg odmora:</strong> ${ctx.workingDaysLabel}</p>
  <p>
    Zaposlenom <strong>${ctx.employeeName}</strong>, ${ctx.jobTitle},
    ${ctx.employmentLine}${ctx.contractLine},
    odobrava se korišćenje godišnjeg odmora u trajanju od <strong>${ctx.workingDaysLabel}</strong> radnih dana,
    u periodu od <strong>${ctx.periodLine.split(' – ')[0]}</strong> do
    <strong>${ctx.periodLine.split(' – ')[1]}</strong>.
  </p>
  <p>Zaposleni se vraća na rad <strong>${ctx.returnLine}</strong>.</p>
  <div class="signature">
    <p>Odobrio/la:</p>
    <p><strong>${ctx.approverName}</strong></p>
    <p>${ctx.approverTitle}</p>
  </div>
</body>
</html>`;
  }

  private async renderDocx(ctx: DecisionContext): Promise<Buffer> {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun(ctx.brandLine)],
            }),
            ...(ctx.addressLine
              ? [new Paragraph({ children: [new TextRun(ctx.addressLine)], spacing: { after: 200 } })]
              : []),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: ctx.title, bold: true, size: 28 })],
              spacing: { after: 300 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Broj: ', bold: true }),
                new TextRun(ctx.decisionNumber),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Datum: ', bold: true }),
                new TextRun(formatSrDate(new Date())),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun(
                  'Na osnovu Zakona o radu i Pravilnika o radu, rešava se:',
                ),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Zaposleni (ime i prezime): ', bold: true }),
                new TextRun({ text: ctx.employeeName, bold: true }),
              ],
              spacing: { after: 120 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Broj radnih dana godišnjeg odmora: ', bold: true }),
                new TextRun({ text: ctx.workingDaysLabel, bold: true }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Zaposlenom ', bold: false }),
                new TextRun({ text: ctx.employeeName, bold: true }),
                new TextRun({ text: `, ${ctx.jobTitle}` }),
                ...(ctx.employmentLine
                  ? [new TextRun({ text: `, ${ctx.employmentLine}${ctx.contractLine}` })]
                  : []),
                new TextRun({
                  text: `, odobrava se korišćenje godišnjeg odmora u trajanju od ${ctx.workingDaysLabel} radnih dana, u periodu od ${ctx.periodLine}.`,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Zaposleni se vraća na rad ', bold: false }),
                new TextRun({ text: ctx.returnLine, bold: true }),
                new TextRun({ text: '.' }),
              ],
              spacing: { after: 400 },
            }),
            new Paragraph({ children: [new TextRun('Odobrio/la:')], spacing: { before: 400 } }),
            new Paragraph({
              children: [new TextRun({ text: ctx.approverName, bold: true })],
            }),
            ...(ctx.approverTitle
              ? [new Paragraph({ children: [new TextRun(ctx.approverTitle)] })]
              : []),
          ],
        },
      ],
    });

    return Packer.toBuffer(doc);
  }
}
