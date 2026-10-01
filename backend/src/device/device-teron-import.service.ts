import { Injectable } from '@nestjs/common';
import { DeviceStatus, LicenceStatus } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { DistributorService } from '../distributor/distributor.service';

export const TERON_IMPORT_MAX_ROWS = 50000;

export interface TeronImportResult {
  created: number;
  updated: number;
  companiesCreated: number;
  distributorsCreated: number;
  licencesCreated: number;
  licencesUpdated: number;
  errors: { row: number; message: string }[];
}

const HEADER_ALIASES: Record<string, string[]> = {
  serialNo: ['serijski broj', 'serialno', 'serial no'],
  name: ['naziv uredjaja', 'naziv uređaja', 'naziv uredaja'],
  productName: ['proizvod', 'product'],
  model: ['model uredjaja', 'model uređaja', 'model'],
  status: ['status'],
  companyName: ['naziv korisnika', 'korisnik', 'companyname', 'company name'],
  distributorName: ['distributer', 'distributor'],
  mdmProfileName: ['mdm profil', 'mdm'],
  sufEnvironment: ['suf okruzenje', 'suf okruženje', 'suf'],
  paymentType: ['tip placanja', 'tip plaćanja', 'payment type'],
  licenceKey: ['bezbednosni element', 'bezbednosni', 'licence key'],
  validFrom: ['vazenje od', 'važenje od', 'valid from'],
  validTo: ['vazenje do', 'važenje do', 'valid to'],
  licenceValidTo: ['vazenje licence', 'važenje licence', 'licence expiry'],
  eFakturaEnvironment: ['efaktura okruzenje', 'efaktura okruženje', 'efaktura'],
  accountSync: ['sinhronizacija racuna', 'sinhronizacija računa', 'account sync'],
  environment: ['okruzenje', 'okruženje', 'environment'],
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

function normalizeNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

function cellStr(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function parseSerbianDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s || s === '-') return null;
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\.\s*(\d{1,2}):(\d{1,2}))?/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const year = parseInt(m[3], 10);
  const hour = m[4] != null ? parseInt(m[4], 10) : 0;
  const min = m[5] != null ? parseInt(m[5], 10) : 0;
  const d = new Date(year, month, day, hour, min);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapDeviceStatus(raw: string): DeviceStatus {
  const s = raw.trim().toLowerCase();
  if (s === 'inactive' || s === 'neaktivan') return 'INACTIVE';
  if (s === 'retired' || s === 'povucen' || s === 'povučen') return 'RETIRED';
  return 'ACTIVE';
}

function mapLicenceStatus(validTo: Date | null): LicenceStatus {
  if (!validTo) return 'ACTIVE';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return validTo < today ? 'EXPIRED' : 'ACTIVE';
}

function buildColumnMap(headers: string[]): Record<string, number> {
  const normHeaders = headers.map(normalizeHeader);
  const col: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = normHeaders.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));
    col[field] = idx >= 0 ? idx : -1;
  }
  return col;
}

function getCol(row: unknown[], col: Record<string, number>, field: string): string {
  const i = col[field];
  if (i == null || i < 0 || i >= row.length) return '';
  return cellStr(row[i]);
}

@Injectable()
export class DeviceTeronImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly distributorService: DistributorService,
  ) {}

  async importFromExcel(
    tenantId: string,
    userId: string,
    fileBuffer: Buffer,
  ): Promise<TeronImportResult> {
    const result: TeronImportResult = {
      created: 0,
      updated: 0,
      companiesCreated: 0,
      distributorsCreated: 0,
      licencesCreated: 0,
      licencesUpdated: 0,
      errors: [],
    };

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(fileBuffer as any);
    const sheet = wb.worksheets[0];
    if (!sheet) {
      result.errors.push({ row: 0, message: 'Excel fajl nema listova.' });
      return result;
    }

    const rows: unknown[][] = [];
    sheet.eachRow((row) => {
      const vals: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        vals[colNumber - 1] = cell.value;
      });
      rows.push(vals);
    });

    if (rows.length < 2) {
      result.errors.push({ row: 0, message: 'Fajl mora imati zaglavlje i bar jedan red podataka.' });
      return result;
    }

    const headerRow = rows[0].map((c) => cellStr(c));
    const col = buildColumnMap(headerRow);
    if ((col.serialNo ?? -1) < 0) {
      result.errors.push({ row: 1, message: 'Kolona "Serijski broj" nije pronađena u zaglavlju.' });
      return result;
    }

    const dataRows = rows.slice(1).filter((r) => r.some((c) => cellStr(c) !== ''));
    if (dataRows.length > TERON_IMPORT_MAX_ROWS) {
      result.errors.push({
        row: 0,
        message: `Maksimalno dozvoljeno ${TERON_IMPORT_MAX_ROWS} redova (fajl ima ${dataRows.length}).`,
      });
      return result;
    }

    const companyByKey = new Map<string, string>();
    const existingCompanies = await this.prisma.company.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });
    for (const c of existingCompanies) {
      companyByKey.set(normalizeNameKey(c.name), c.id);
    }
    let companySeq = existingCompanies.length;

    const distributorByKey = new Map<string, string>();
    const existingDistributors = await this.prisma.distributor.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });
    for (const d of existingDistributors) {
      distributorByKey.set(normalizeNameKey(d.name), d.id);
    }

    const resolveCompany = async (displayName: string): Promise<string | null> => {
      const trimmed = displayName.trim();
      if (!trimmed || trimmed === '-') return null;
      const key = normalizeNameKey(trimmed);
      const cached = companyByKey.get(key);
      if (cached) return cached;

      const matches = await this.prisma.company.findMany({
        where: { tenantId, name: { equals: trimmed, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (matches.length === 1) {
        companyByKey.set(key, matches[0].id);
        return matches[0].id;
      }

      companySeq += 1;
      const created = await this.prisma.company.create({
        data: {
          tenantId,
          key: `C-${String(companySeq).padStart(6, '0')}`,
          name: trimmed,
        },
      });
      companyByKey.set(key, created.id);
      result.companiesCreated += 1;
      return created.id;
    };

    const resolveDistributor = async (displayName: string): Promise<string | null> => {
      const trimmed = displayName.trim();
      if (!trimmed || trimmed === '-') return null;
      const key = normalizeNameKey(trimmed);
      const cached = distributorByKey.get(key);
      if (cached) return cached;

      const { id, created } = await this.distributorService.findOrCreateByName(tenantId, trimmed);
      distributorByKey.set(key, id);
      if (created) result.distributorsCreated += 1;
      return id;
    };

    for (let i = 0; i < dataRows.length; i++) {
      const rowNum = i + 2;
      const row = dataRows[i];
      try {
        const serialNo = getCol(row, col, 'serialNo');
        if (!serialNo) {
          result.errors.push({ row: rowNum, message: 'Serijski broj je obavezan.' });
          continue;
        }

        const companyName = getCol(row, col, 'companyName');
        const distributorName = getCol(row, col, 'distributorName');
        const companyId = companyName ? await resolveCompany(companyName) : null;
        const distributorId = distributorName ? await resolveDistributor(distributorName) : null;

        const nameRaw = getCol(row, col, 'name');
        const name = nameRaw && nameRaw !== '-' ? nameRaw : null;
        const model = getCol(row, col, 'model') || null;
        const status = mapDeviceStatus(getCol(row, col, 'status') || 'aktivan');
        const mdmProfileName = getCol(row, col, 'mdmProfileName') || null;
        const sufEnvironment = getCol(row, col, 'sufEnvironment') || getCol(row, col, 'environment') || null;
        const eFakturaEnvironment = getCol(row, col, 'eFakturaEnvironment') || null;
        const paymentType = getCol(row, col, 'paymentType') || null;
        const accountSyncRaw = getCol(row, col, 'accountSync');
        const accountSync =
          accountSyncRaw && accountSyncRaw !== '-'
            ? accountSyncRaw.toLowerCase().includes('uklj')
              ? 'uključena'
              : accountSyncRaw.toLowerCase().includes('iskl')
                ? 'isključena'
                : accountSyncRaw
            : null;
        const testDevice =
          (name?.toLowerCase().includes('test') ?? false) ||
          (companyName?.toLowerCase().includes('test') ?? false);

        const deviceData = {
          companyId,
          distributorId,
          name,
          model: model || null,
          status,
          mdmProfileName: mdmProfileName || null,
          sufEnvironment: sufEnvironment || null,
          eFakturaEnvironment: eFakturaEnvironment || null,
          paymentType: paymentType || null,
          accountSync,
          testDevice,
        };

        const existing = await this.prisma.device.findUnique({
          where: { tenantId_serialNo: { tenantId, serialNo } },
        });

        let deviceId: string;
        if (existing) {
          await this.prisma.device.update({
            where: { id: existing.id },
            data: deviceData,
          });
          deviceId = existing.id;
          result.updated += 1;
        } else {
          const created = await this.prisma.device.create({
            data: { tenantId, serialNo, ...deviceData },
          });
          deviceId = created.id;
          result.created += 1;
        }

        const productName = getCol(row, col, 'productName') || 'Teron POS';
        const licenceKeyRaw = getCol(row, col, 'licenceKey');
        const licenceKey = licenceKeyRaw && licenceKeyRaw !== '-' ? licenceKeyRaw : null;
        let validTo =
          parseSerbianDate(getCol(row, col, 'licenceValidTo')) ||
          parseSerbianDate(getCol(row, col, 'validTo'));
        const validFrom = parseSerbianDate(getCol(row, col, 'validFrom'));

        if (!validTo && !validFrom && !licenceKey) continue;
        if (!validTo) validTo = validFrom ? new Date(validFrom.getTime()) : new Date();
        if (validFrom && validTo < validFrom) validTo = validFrom;

        const licenceCompanyId = companyId;
        if (!licenceCompanyId) continue;

        const existingLicence = await this.prisma.licence.findFirst({
          where: {
            tenantId,
            deviceId,
            productName,
          },
          orderBy: { updatedAt: 'desc' },
        });

        const licenceStatus = mapLicenceStatus(validTo);
        if (existingLicence) {
          await this.prisma.licence.update({
            where: { id: existingLicence.id },
            data: {
              companyId: licenceCompanyId,
              licenceKey,
              validFrom,
              validTo,
              status: licenceStatus,
            },
          });
          result.licencesUpdated += 1;
        } else {
          const licence = await this.prisma.licence.create({
            data: {
              tenantId,
              companyId: licenceCompanyId,
              deviceId,
              productName,
              licenceKey,
              validFrom,
              validTo,
              status: licenceStatus,
            },
          });
          await this.prisma.licenceEvent.create({
            data: {
              tenantId,
              licenceId: licence.id,
              type: 'CREATED',
              createdByUserId: userId,
            },
          });
          result.licencesCreated += 1;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        result.errors.push({ row: rowNum, message: msg });
      }
    }

    return result;
  }
}
