import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import { Prisma } from '@prisma/client';

type SalesDirectoryRowInput = {
  mb?: string;
  pib?: string;
  establishedAt?: Date;
  companyName?: string;
  city?: string;
  postalCode?: string;
  address?: string;
  phone?: string;
  legalForm?: string;
  activityCode?: string;
  activityName?: string;
  aprStatus?: string;
  email?: string;
  representative?: string;
  description?: string;
  sizeClass?: string;
  fieldColors?: Record<string, string>;
};

const HEADER_MAP: Record<string, keyof SalesDirectoryRowInput> = {
  mb: 'mb',
  pib: 'pib',
  'datum osnivanja': 'establishedAt',
  'naziv preduzeca': 'companyName',
  'naziv preduzeca ': 'companyName',
  mesto: 'city',
  'postanski broj': 'postalCode',
  adresa: 'address',
  telefon: 'phone',
  'pravni oblik': 'legalForm',
  'sifra delatnosti': 'activityCode',
  'naziv delatnosti': 'activityName',
  'apr status': 'aprStatus',
  email: 'email',
  zastupnik: 'representative',
  opis: 'description',
  'polu/mali': 'sizeClass',
  'polu mali': 'sizeClass',
};

const EXPORT_COLUMNS: { key: keyof SalesDirectoryRowInput; header: string }[] =
  [
    { key: 'mb', header: 'MB' },
    { key: 'pib', header: 'PIB' },
    { key: 'establishedAt', header: 'Datum osnivanja' },
    { key: 'companyName', header: 'Naziv preduzeca' },
    { key: 'city', header: 'Mesto' },
    { key: 'postalCode', header: 'Postanski broj' },
    { key: 'address', header: 'Adresa' },
    { key: 'phone', header: 'Telefon' },
    { key: 'legalForm', header: 'Pravni oblik' },
    { key: 'activityCode', header: 'Sifra delatnosti' },
    { key: 'activityName', header: 'Naziv delatnosti' },
    { key: 'aprStatus', header: 'APR status' },
    { key: 'email', header: 'Email' },
    { key: 'representative', header: 'Zastupnik' },
    { key: 'description', header: 'Opis' },
    { key: 'sizeClass', header: 'Polu/mali' },
  ];

const FILTERABLE_FIELDS = new Set([
  'mb',
  'pib',
  'companyName',
  'city',
  'postalCode',
  'address',
  'phone',
  'legalForm',
  'activityCode',
  'activityName',
  'aprStatus',
  'email',
  'representative',
  'description',
  'sizeClass',
]);

function normalizeHeader(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeText(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function parseDateValue(v: unknown): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v;
  const text = String(v).trim();
  if (!text) return undefined;
  const dt = new Date(text);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

function colorFromArgb(argb?: string): string | undefined {
  if (!argb) return undefined;
  const hex = argb.length >= 6 ? argb.slice(-6) : argb;
  return /^([A-Fa-f0-9]{6})$/.test(hex) ? `#${hex.toUpperCase()}` : undefined;
}

function externalKey(row: SalesDirectoryRowInput): string {
  return [row.mb ?? '', row.pib ?? '', row.companyName ?? ''].join('|');
}

@Injectable()
export class SalesImportService {
  constructor(private readonly prisma: PrismaService) {}

  private toInput(dto: Record<string, unknown>): SalesDirectoryRowInput {
    const out: SalesDirectoryRowInput = {};
    if (dto.mb !== undefined) out.mb = normalizeText(dto.mb);
    if (dto.pib !== undefined) out.pib = normalizeText(dto.pib);
    if (dto.establishedAt !== undefined)
      out.establishedAt = parseDateValue(dto.establishedAt);
    if (dto.companyName !== undefined)
      out.companyName = normalizeText(dto.companyName);
    if (dto.city !== undefined) out.city = normalizeText(dto.city);
    if (dto.postalCode !== undefined)
      out.postalCode = normalizeText(dto.postalCode);
    if (dto.address !== undefined) out.address = normalizeText(dto.address);
    if (dto.phone !== undefined) out.phone = normalizeText(dto.phone);
    if (dto.legalForm !== undefined)
      out.legalForm = normalizeText(dto.legalForm);
    if (dto.activityCode !== undefined)
      out.activityCode = normalizeText(dto.activityCode);
    if (dto.activityName !== undefined)
      out.activityName = normalizeText(dto.activityName);
    if (dto.aprStatus !== undefined)
      out.aprStatus = normalizeText(dto.aprStatus);
    if (dto.email !== undefined) out.email = normalizeText(dto.email);
    if (dto.representative !== undefined)
      out.representative = normalizeText(dto.representative);
    if (dto.description !== undefined)
      out.description = normalizeText(dto.description);
    if (dto.sizeClass !== undefined)
      out.sizeClass = normalizeText(dto.sizeClass);
    if (dto.fieldColors !== undefined)
      out.fieldColors = dto.fieldColors as Record<string, string>;
    return out;
  }

  async list(
    tenantId: string,
    page = 1,
    limit = 50,
    filterField?: string,
    filterValue?: string,
  ) {
    const take = Math.min(200, Math.max(1, limit));
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * take;
    const where: Prisma.SalesDirectoryRowWhereInput = { tenantId };
    const fv = (filterValue ?? '').trim();
    const ff = (filterField ?? '').trim();
    if (fv) {
      if (ff && FILTERABLE_FIELDS.has(ff)) {
        (where as Record<string, unknown>)[ff] = {
          contains: fv,
          mode: 'insensitive',
        };
      } else {
        where.OR = [...FILTERABLE_FIELDS].map((field) => ({
          [field]: { contains: fv, mode: 'insensitive' },
        }));
      }
    }
    const [items, total] = await Promise.all([
      this.prisma.salesDirectoryRow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.salesDirectoryRow.count({ where }),
    ]);
    return { items, total, page: safePage, limit: take };
  }

  async importFile(
    tenantId: string,
    file: Express.Multer.File,
    userId?: string,
  ) {
    const name = file.originalname.toLowerCase();
    const rows =
      name.endsWith('.xlsx') || name.endsWith('.xls')
        ? await this.parseXlsx(file.buffer)
        : name.endsWith('.csv')
          ? this.parseCsv(file.buffer)
          : null;

    if (!rows)
      throw new BadRequestException('Supported formats: .xlsx, .xls, .csv');

    let upserted = 0;
    for (const row of rows) {
      const key = externalKey(row);
      if (!key.replace(/\|/g, '').trim()) continue;
      await this.prisma.salesDirectoryRow.upsert({
        where: { tenantId_externalKey: { tenantId, externalKey: key } },
        create: {
          tenantId,
          externalKey: key,
          ...row,
        },
        update: {
          ...row,
        },
      });
      upserted++;
    }

    return {
      imported: upserted,
      skipped: Math.max(0, rows.length - upserted),
      sourceFile: file.originalname,
      byUserId: userId ?? null,
    };
  }

  async createManual(tenantId: string, dto: Record<string, unknown>) {
    const row = this.toInput(dto);
    const base = externalKey(row)
      .replace(/\|/g, '_')
      .replace(/\s+/g, '')
      .slice(0, 80);
    const externalKeyValue = `${base || 'manual'}_${Date.now()}`;
    return this.prisma.salesDirectoryRow.create({
      data: {
        tenantId,
        externalKey: externalKeyValue,
        ...row,
      },
    });
  }

  async updateRow(tenantId: string, id: string, dto: Record<string, unknown>) {
    const row = this.toInput(dto);
    return this.prisma.salesDirectoryRow.updateMany({
      where: { id, tenantId },
      data: row,
    });
  }

  async getOne(tenantId: string, id: string) {
    return this.prisma.salesDirectoryRow.findFirst({
      where: { tenantId, id },
    });
  }

  async exportRows(
    tenantId: string,
    format: 'csv' | 'xlsx',
  ): Promise<Buffer | string> {
    const rows = await this.prisma.salesDirectoryRow.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });

    if (format === 'csv') {
      const header = EXPORT_COLUMNS.map((c) => c.header).join(',');
      const lines = rows.map((r) =>
        EXPORT_COLUMNS.map(({ key }) => {
          const value =
            key === 'establishedAt'
              ? r.establishedAt
                ? r.establishedAt.toISOString().slice(0, 10)
                : ''
              : ((r as Record<string, unknown>)[key] ?? '');
          const str = String(value);
          return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(','),
      );
      return [header, ...lines].join('\r\n');
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Prodaja');
    ws.addRow(EXPORT_COLUMNS.map((c) => c.header));
    rows.forEach((r) => {
      const rowValues = EXPORT_COLUMNS.map(({ key }) => {
        if (key === 'establishedAt')
          return r.establishedAt
            ? r.establishedAt.toISOString().slice(0, 10)
            : '';
        return (r as Record<string, unknown>)[key] ?? '';
      });
      const xRow = ws.addRow(rowValues);
      const colors = (r.fieldColors as Record<string, string> | null) ?? null;
      if (colors) {
        EXPORT_COLUMNS.forEach((col, idx) => {
          const c = colors[col.key];
          if (c && /^#[A-Fa-f0-9]{6}$/.test(c)) {
            xRow.getCell(idx + 1).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: `FF${c.replace('#', '').toUpperCase()}` },
            };
          }
        });
      }
    });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private parseCsv(buffer: Buffer): SalesDirectoryRowInput[] {
    const text = buffer.toString('utf-8');
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as Record<string, string>[];
    return records.map((record) => {
      const row: SalesDirectoryRowInput = {};
      for (const [k, v] of Object.entries(record)) {
        const field = HEADER_MAP[normalizeHeader(k)];
        if (!field) continue;
        if (field === 'establishedAt') row.establishedAt = parseDateValue(v);
        else (row[field] as unknown) = normalizeText(v);
      }
      return row;
    });
  }

  private async parseXlsx(buffer: Buffer): Promise<SalesDirectoryRowInput[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    if (!ws) return [];

    const headerRow = ws.getRow(1);
    const colToField = new Map<number, keyof SalesDirectoryRowInput>();
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const field = HEADER_MAP[normalizeHeader(String(cell.text ?? ''))];
      if (field) colToField.set(colNumber, field);
    });

    const out: SalesDirectoryRowInput[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const item: SalesDirectoryRowInput = {};
      const colors: Record<string, string> = {};
      colToField.forEach((field, colNumber) => {
        const cell = row.getCell(colNumber);
        const value = cell.value as unknown;
        if (field === 'establishedAt') {
          if (value instanceof Date) item.establishedAt = value;
          else item.establishedAt = parseDateValue(cell.text || value);
        } else {
          (item[field] as unknown) = normalizeText(cell.text || value);
        }
        const fill = cell.fill as
          | { fgColor?: { argb?: string }; bgColor?: { argb?: string } }
          | undefined;
        const color = colorFromArgb(fill?.fgColor?.argb ?? fill?.bgColor?.argb);
        if (color) colors[field] = color;
      });
      if (Object.keys(colors).length) item.fieldColors = colors;
      if (Object.values(item).some((v) => v != null && String(v).trim() !== ''))
        out.push(item);
    });

    return out;
  }
}
