import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import { Prisma } from '@prisma/client';

type DistributorEmailRowInput = {
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
  nbsStatus?: string;
  creditRating?: string;
  size?: string;
  revenueEur?: string;
  netProfitEur?: string;
  employeesCount?: string;
  ebitEur?: string;
  ebitdaEur?: string;
  email?: string;
  representative?: string;
  vatRegistered?: string;
  fieldColors?: Record<string, string>;
};

const HEADER_MAP: Record<string, keyof DistributorEmailRowInput> = {
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
  'nbs status': 'nbsStatus',
  'bonitetna ocena': 'creditRating',
  velicina: 'size',
  'promet (eur)': 'revenueEur',
  'neto dobit (eur)': 'netProfitEur',
  'broj zaposlenih': 'employeesCount',
  'ebit (eur)': 'ebitEur',
  'ebitda (eur)': 'ebitdaEur',
  email: 'email',
  zastupnik: 'representative',
  'pdv obveznik': 'vatRegistered',
};

const EXPORT_COLUMNS: { key: keyof DistributorEmailRowInput; header: string }[] =
  [
    { key: 'mb', header: 'MB' },
    { key: 'pib', header: 'PIB' },
    { key: 'establishedAt', header: 'Datum osnivanja' },
    { key: 'companyName', header: 'Naziv preduzeća' },
    { key: 'city', header: 'Mesto' },
    { key: 'postalCode', header: 'Poštanski broj' },
    { key: 'address', header: 'Adresa' },
    { key: 'phone', header: 'Telefon' },
    { key: 'legalForm', header: 'Pravni oblik' },
    { key: 'activityCode', header: 'Šifra delatnosti' },
    { key: 'activityName', header: 'Naziv delatnosti' },
    { key: 'aprStatus', header: 'APR Status' },
    { key: 'nbsStatus', header: 'NBS Status' },
    { key: 'creditRating', header: 'Bonitetna ocena' },
    { key: 'size', header: 'Veličina' },
    { key: 'revenueEur', header: 'Promet (EUR)' },
    { key: 'netProfitEur', header: 'Neto dobit (EUR)' },
    { key: 'employeesCount', header: 'Broj zaposlenih' },
    { key: 'ebitEur', header: 'Ebit (EUR)' },
    { key: 'ebitdaEur', header: 'Ebitda (EUR)' },
    { key: 'email', header: 'Email' },
    { key: 'representative', header: 'Zastupnik' },
    { key: 'vatRegistered', header: 'PDV Obveznik' },
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
  'nbsStatus',
  'creditRating',
  'size',
  'revenueEur',
  'netProfitEur',
  'employeesCount',
  'ebitEur',
  'ebitdaEur',
  'email',
  'representative',
  'vatRegistered',
]);

function normalizeHeader(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function mapHeaderToField(
  normHeader: string,
): keyof DistributorEmailRowInput | undefined {
  const direct = HEADER_MAP[normHeader];
  if (direct) return direct;
  if (normHeader.includes('osnivanja')) return 'establishedAt';
  return undefined;
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
  const iso = new Date(text);
  if (!Number.isNaN(iso.getTime())) return iso;

  const m = text.match(/^(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{2,4})/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year = year + (year < 70 ? 2000 : 1900);

    let day: number;
    let month: number;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      month = a;
      day = b;
    } else {
      day = a;
      month = b;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
    const dt = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(dt.getTime()) ? undefined : dt;
  }

  return undefined;
}

function excelSerialToDate(serial: number): Date | undefined {
  if (!Number.isFinite(serial)) return undefined;
  const utcMillis = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000;
  const dt = new Date(utcMillis);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

function colorFromArgb(argb?: string): string | undefined {
  if (!argb) return undefined;
  const hex = argb.length >= 6 ? argb.slice(-6) : argb;
  return /^([A-Fa-f0-9]{6})$/.test(hex) ? `#${hex.toUpperCase()}` : undefined;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateDdMmYyyy(d?: Date | null): string {
  if (!d) return '';
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  const year = d.getUTCFullYear();
  return `${pad2(day)}/${pad2(month)}/${year}`;
}

function externalKey(row: DistributorEmailRowInput): string {
  return [row.mb ?? '', row.pib ?? '', row.companyName ?? ''].join('|');
}

type SortField = 'createdAt' | 'establishedAt';
type SortOrder = 'asc' | 'desc';

function buildOrderBy(
  sortBy?: string,
  sortOrder?: string,
): Prisma.SalesDistributorEmailRowOrderByWithRelationInput[] {
  const field: SortField =
    sortBy === 'establishedAt' ? 'establishedAt' : 'createdAt';
  const dir: SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
  return [{ [field]: dir }, { createdAt: 'desc' }, { id: 'desc' }];
}

function rowToDbData(row: DistributorEmailRowInput) {
  const data: {
    mb?: string | null;
    pib?: string | null;
    establishedAt?: Date | null;
    companyName?: string | null;
    city?: string | null;
    postalCode?: string | null;
    address?: string | null;
    phone?: string | null;
    legalForm?: string | null;
    activityCode?: string | null;
    activityName?: string | null;
    aprStatus?: string | null;
    nbsStatus?: string | null;
    creditRating?: string | null;
    size?: string | null;
    revenueEur?: string | null;
    netProfitEur?: string | null;
    employeesCount?: string | null;
    ebitEur?: string | null;
    ebitdaEur?: string | null;
    email?: string | null;
    representative?: string | null;
    vatRegistered?: string | null;
    fieldColors?: Prisma.InputJsonValue;
  } = {};

  if (row.mb !== undefined) data.mb = row.mb;
  if (row.pib !== undefined) data.pib = row.pib;
  if (row.establishedAt !== undefined) data.establishedAt = row.establishedAt;
  if (row.companyName !== undefined) data.companyName = row.companyName;
  if (row.city !== undefined) data.city = row.city;
  if (row.postalCode !== undefined) data.postalCode = row.postalCode;
  if (row.address !== undefined) data.address = row.address;
  if (row.phone !== undefined) data.phone = row.phone;
  if (row.legalForm !== undefined) data.legalForm = row.legalForm;
  if (row.activityCode !== undefined) data.activityCode = row.activityCode;
  if (row.activityName !== undefined) data.activityName = row.activityName;
  if (row.aprStatus !== undefined) data.aprStatus = row.aprStatus;
  if (row.nbsStatus !== undefined) data.nbsStatus = row.nbsStatus;
  if (row.creditRating !== undefined) data.creditRating = row.creditRating;
  if (row.size !== undefined) data.size = row.size;
  if (row.revenueEur !== undefined) data.revenueEur = row.revenueEur;
  if (row.netProfitEur !== undefined) data.netProfitEur = row.netProfitEur;
  if (row.employeesCount !== undefined) data.employeesCount = row.employeesCount;
  if (row.ebitEur !== undefined) data.ebitEur = row.ebitEur;
  if (row.ebitdaEur !== undefined) data.ebitdaEur = row.ebitdaEur;
  if (row.email !== undefined) data.email = row.email;
  if (row.representative !== undefined) data.representative = row.representative;
  if (row.vatRegistered !== undefined) data.vatRegistered = row.vatRegistered;
  if (row.fieldColors !== undefined) data.fieldColors = row.fieldColors;
  return data;
}

@Injectable()
export class SalesDistributorEmailsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    page = 1,
    limit = 50,
    filterField?: string,
    filterValue?: string,
    sortBy?: string,
    sortOrder?: string,
  ) {
    const take = Math.min(200, Math.max(1, limit));
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * take;
    const where: Prisma.SalesDistributorEmailRowWhereInput = { tenantId };
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
      this.prisma.salesDistributorEmailRow.findMany({
        where,
        orderBy: buildOrderBy(sortBy, sortOrder),
        skip,
        take,
      }),
      this.prisma.salesDistributorEmailRow.count({ where }),
    ]);
    return { items, total, page: safePage, limit: take };
  }

  async importFile(tenantId: string, file: Express.Multer.File, userId?: string) {
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
    let skipped = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const key = externalKey(row);
      if (!key.replace(/\|/g, '').trim()) {
        skipped++;
        continue;
      }
      const data = rowToDbData(row);
      try {
        await this.prisma.salesDistributorEmailRow.upsert({
          where: { tenantId_externalKey: { tenantId, externalKey: key } },
          create: {
            tenantId,
            externalKey: key,
            ...data,
          },
          update: data,
        });
        upserted++;
      } catch (err) {
        skipped++;
        const message =
          err instanceof Error ? err.message : 'Nepoznata greška pri upisu reda';
        errors.push({ row: i + 2, message });
      }
    }

    return {
      imported: upserted,
      skipped,
      totalRows: rows.length,
      errors: errors.slice(0, 20),
      sourceFile: file.originalname,
      byUserId: userId ?? null,
    };
  }

  async exportRows(
    tenantId: string,
    format: 'csv' | 'xlsx',
    sortBy?: string,
    sortOrder?: string,
  ): Promise<Buffer | string> {
    const rows = await this.prisma.salesDistributorEmailRow.findMany({
      where: { tenantId },
      orderBy: buildOrderBy(sortBy, sortOrder),
    });

    if (format === 'csv') {
      const header = EXPORT_COLUMNS.map((c) => c.header).join(',');
      const lines = rows.map((r) =>
        EXPORT_COLUMNS.map(({ key }) => {
          const value =
            key === 'establishedAt'
              ? r.establishedAt
                ? formatDateDdMmYyyy(r.establishedAt)
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
          return r.establishedAt ? formatDateDdMmYyyy(r.establishedAt) : '';
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

  private parseCsv(buffer: Buffer): DistributorEmailRowInput[] {
    const text = buffer.toString('utf-8');
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as Record<string, string>[];
    return records.map((record) => {
      const row: DistributorEmailRowInput = {};
      for (const [k, v] of Object.entries(record)) {
        const field = mapHeaderToField(normalizeHeader(k));
        if (!field) continue;
        if (field === 'establishedAt') row.establishedAt = parseDateValue(v);
        else (row[field] as unknown) = normalizeText(v);
      }
      return row;
    });
  }

  private async parseXlsx(buffer: Buffer): Promise<DistributorEmailRowInput[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    if (!ws) return [];

    const headerRow = ws.getRow(1);
    const colToField = new Map<number, keyof DistributorEmailRowInput>();
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const field = mapHeaderToField(normalizeHeader(String(cell.text ?? '')));
      if (field) colToField.set(colNumber, field);
    });

    const out: DistributorEmailRowInput[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const item: DistributorEmailRowInput = {};
      const colors: Record<string, string> = {};
      colToField.forEach((field, colNumber) => {
        const cell = row.getCell(colNumber);
        const value = cell.value as unknown;
        if (field === 'establishedAt') {
          if (value instanceof Date) item.establishedAt = value;
          else if (typeof value === 'number')
            item.establishedAt = excelSerialToDate(value);
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

