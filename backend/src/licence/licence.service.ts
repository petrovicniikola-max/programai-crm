import { Injectable, NotFoundException } from '@nestjs/common';
import { LicenceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../settings/audit-log.service';
import { CreateLicenceDto } from './dto/create-licence.dto';
import { UpdateLicenceDto } from './dto/update-licence.dto';
import { ListLicencesQueryDto } from './dto/list-licences-query.dto';
import { RenewLicenceDto } from './dto/renew-licence.dto';

@Injectable()
export class LicenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateLicenceDto) {
    const validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    const validTo = new Date(dto.validTo);
    const device = await this.prisma.licence.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        deviceId: dto.deviceId || null,
        productName: dto.productName.trim(),
        licenceKey: dto.licenceKey?.trim() || null,
        validFrom,
        validTo,
        status: (dto.status as 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED') ?? 'ACTIVE',
        notes: dto.notes?.trim() || null,
      },
      include: { company: true, device: true },
    });
    await this.prisma.licenceEvent.create({
      data: {
        tenantId,
        licenceId: device.id,
        type: 'CREATED',
        createdByUserId: userId,
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId: userId,
      action: 'CREATE_LICENCE',
      entityType: 'Licence',
      entityId: device.id,
      metadata: { productName: device.productName, companyId: device.companyId },
    });
    return device;
  }

  async findAll(tenantId: string, query: ListLicencesQueryDto) {
    const where: {
      tenantId: string;
      companyId?: string;
      status?: LicenceStatus;
      validTo?: { gte?: Date; lte?: Date };
    } = { tenantId };
    if (query.companyId) where.companyId = query.companyId;
    if (query.status) where.status = query.status as LicenceStatus;
    if (query.validFrom || query.validTo) {
      where.validTo = {};
      if (query.validFrom) where.validTo.gte = new Date(query.validFrom);
      if (query.validTo) where.validTo.lte = new Date(query.validTo);
    }
    if (query.expiringInDays != null) {
      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + query.expiringInDays);
      where.validTo = { gte: now, lte: end };
    }
    return this.prisma.licence.findMany({
      where,
      include: { company: true, device: true },
      orderBy: { validTo: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const licence = await this.prisma.licence.findFirst({
      where: { id, tenantId },
      include: { company: true, device: true },
    });
    if (!licence) throw new NotFoundException('Licence not found');
    return licence;
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateLicenceDto) {
    await this.findOne(tenantId, id);
    const data: Record<string, unknown> = {};
    if (dto.deviceId !== undefined) data.deviceId = dto.deviceId || null;
    if (dto.productName !== undefined) data.productName = dto.productName.trim();
    if (dto.licenceKey !== undefined) data.licenceKey = dto.licenceKey?.trim() || null;
    if (dto.validFrom !== undefined) data.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validTo !== undefined) data.validTo = new Date(dto.validTo);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    const licence = await this.prisma.licence.update({
      where: { id },
      data: data as object,
      include: { company: true, device: true },
    });
    await this.audit.log({
      tenantId,
      actorUserId: userId,
      action: 'UPDATE_LICENCE',
      entityType: 'Licence',
      entityId: id,
      metadata: data,
    });
    return licence;
  }

  async renew(tenantId: string, userId: string, id: string, dto: RenewLicenceDto) {
    const licence = await this.findOne(tenantId, id);
    const validTo = new Date(dto.validTo);
    await this.prisma.licence.update({
      where: { id },
      data: { validTo, status: 'ACTIVE' },
    });
    await this.prisma.licenceEvent.create({
      data: {
        tenantId,
        licenceId: id,
        type: 'RENEWED',
        note: dto.note?.trim() || null,
        createdByUserId: userId,
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId: userId,
      action: 'RENEW_LICENCE',
      entityType: 'Licence',
      entityId: id,
      metadata: { validTo: validTo.toISOString() },
    });
    return this.findOne(tenantId, id);
  }

  async expiringSoon(tenantId: string, days = 30) {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + days);
    return this.prisma.licence.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        validTo: { gte: now, lte: end },
      },
      include: { company: true, device: true },
      orderBy: { validTo: 'asc' },
    });
  }

  async stats(tenantId: string) {
    const activeCount = await this.prisma.licence.count({
      where: { tenantId, status: 'ACTIVE' },
    });
    const expiring: Record<string, number> = {};
    const days = [30, 14, 7, 1];
    const today = new Date();
    for (const d of days) {
      const start = new Date(today);
      start.setDate(start.getDate() + d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      const count = await this.prisma.licence.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          validTo: { gte: start, lte: end },
        },
      });
      expiring[String(d)] = count;
    }
    return { activeCount, expiring };
  }

  /** CSV export with same filters as findAll */
  async exportCsv(tenantId: string, query: ListLicencesQueryDto): Promise<string> {
    const licences = await this.findAll(tenantId, query);
    const header =
      'companyId,companyName,deviceId,deviceSerialNo,productName,licenceKey,validFrom,validTo,status,notes,createdAt,updatedAt';
    const lines = licences.map(
      (l) =>
        [
          l.companyId,
          escapeCsv(l.company?.name ?? ''),
          l.deviceId ?? '',
          escapeCsv(l.device?.serialNo ?? ''),
          escapeCsv(l.productName),
          escapeCsv(l.licenceKey ?? ''),
          l.validFrom?.toISOString() ?? '',
          l.validTo.toISOString(),
          l.status,
          escapeCsv(l.notes ?? ''),
          l.createdAt.toISOString(),
          l.updatedAt.toISOString(),
        ].join(','),
    );
    return [header, ...lines].join('\r\n');
  }

  /** CSV template for import (header + one example row) */
  getImportTemplateCsv(): string {
    const header = 'companyId,companyName,deviceId,deviceSerialNo,productName,licenceKey,validFrom,validTo,status,notes';
    const example = '<company-id>,Moja Kompanija,,SN001,Program XY,,2025-01-01,2026-01-01,ACTIVE,';
    return [header, example].join('\r\n');
  }

  /** Import licences from CSV file. Returns created count and per-row errors. */
  async importFromCsv(
    tenantId: string,
    userId: string,
    fileBuffer: Buffer,
  ): Promise<{ created: number; errors: { row: number; message: string }[] }> {
    const MAX_ROWS = 500;
    const errors: { row: number; message: string }[] = [];
    let created = 0;
    const raw = fileBuffer.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = raw.split('\n').map((s) => s.trim()).filter(Boolean);
    if (lines.length < 2) {
      return { created: 0, errors: [{ row: 0, message: 'CSV mora imati zaglavlje i bar jedan red podataka.' }] };
    }
    const headerLine = lines[0];
    const dataLines = lines.slice(1);
    if (dataLines.length > MAX_ROWS) {
      return { created: 0, errors: [{ row: 0, message: `Maksimalno dozvoljeno ${MAX_ROWS} redova.` }] };
    }
    const headerCols = parseCsvLine(headerLine);
    const col = (name: string) => {
      const i = headerCols.findIndex((h) => h.toLowerCase() === name.toLowerCase());
      return i >= 0 ? i : -1;
    };
    const idx = {
      companyId: col('companyId'),
      companyName: col('companyName'),
      deviceId: col('deviceId'),
      deviceSerialNo: col('deviceSerialNo'),
      productName: col('productName'),
      licenceKey: col('licenceKey'),
      validFrom: col('validFrom'),
      validTo: col('validTo'),
      status: col('status'),
      notes: col('notes'),
    };
    const statusSet = new Set<string>(['ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED']);

    for (let i = 0; i < dataLines.length; i++) {
      const rowNum = i + 2;
      const cells = parseCsvLine(dataLines[i]);
      const get = (k: keyof typeof idx) =>
        idx[k] >= 0 && cells[idx[k]] !== undefined ? String(cells[idx[k]]).trim() : '';
      const rawCompanyId = get('companyId');
      const companyName = get('companyName') || null;
      const rawDeviceId = get('deviceId') || undefined;
      const deviceSerialNo = get('deviceSerialNo') || undefined;
      const productName = get('productName');
      const licenceKey = get('licenceKey') || undefined;
      const validFromStr = get('validFrom');
      const validToStr = get('validTo');
      const statusRaw = get('status') || 'ACTIVE';
      const status = statusSet.has(statusRaw) ? statusRaw : 'ACTIVE';
      const notes = get('notes') || undefined;

      let companyId = rawCompanyId || null;
      if (!companyId && !companyName) {
        errors.push({ row: rowNum, message: 'companyId ili companyName je obavezan.' });
        continue;
      }
      if (companyId) {
        const company = await this.prisma.company.findFirst({ where: { id: companyId, tenantId } });
        if (!company) {
          errors.push({ row: rowNum, message: `Kompanija sa ID "${companyId}" nije pronađena.` });
          continue;
        }
      } else if (companyName) {
        const matches = await this.prisma.company.findMany({
          where: { tenantId, name: { equals: companyName, mode: 'insensitive' } },
        });
        if (matches.length === 0) {
          errors.push({ row: rowNum, message: `Kompanija sa nazivom "${companyName}" nije pronađena.` });
          continue;
        }
        if (matches.length > 1) {
          errors.push({
            row: rowNum,
            message: `Više kompanija sa nazivom "${companyName}". Koristi companyId ili precizniji naziv.`,
          });
          continue;
        }
        companyId = matches[0].id;
      }
      if (!productName) {
        errors.push({ row: rowNum, message: 'productName je obavezan.' });
        continue;
      }
      if (!validToStr) {
        errors.push({ row: rowNum, message: 'validTo je obavezan (npr. YYYY-MM-DD).' });
        continue;
      }
      const validTo = new Date(validToStr);
      if (Number.isNaN(validTo.getTime())) {
        errors.push({ row: rowNum, message: `validTo nije ispravan datum: "${validToStr}".` });
        continue;
      }
      const validFrom = validFromStr ? new Date(validFromStr) : undefined;
      if (validFromStr && Number.isNaN((validFrom as Date).getTime())) {
        errors.push({ row: rowNum, message: `validFrom nije ispravan datum: "${validFromStr}".` });
        continue;
      }
      let deviceId = rawDeviceId;
      if (deviceId) {
        const device = await this.prisma.device.findFirst({ where: { id: deviceId, tenantId } });
        if (!device) {
          errors.push({ row: rowNum, message: `Uređaj sa ID "${deviceId}" nije pronađen.` });
          continue;
        }
      } else if (deviceSerialNo) {
        const device = await this.prisma.device.findUnique({
          where: { tenantId_serialNo: { tenantId, serialNo: deviceSerialNo } },
        });
        if (!device) {
          errors.push({ row: rowNum, message: `Uređaj sa serijskim brojem "${deviceSerialNo}" nije pronađen.` });
          continue;
        }
        deviceId = device.id;
      }

      try {
        await this.create(tenantId, userId, {
          companyId: companyId!,
          deviceId,
          productName,
          licenceKey,
          validFrom: validFrom ? (validFrom as Date).toISOString().slice(0, 10) : undefined,
          validTo: validTo.toISOString().slice(0, 10),
          status,
          notes,
        });
        created++;
      } catch (e: any) {
        errors.push({ row: rowNum, message: e?.message ?? String(e) });
      }
    }
    return { created, errors };
  }
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let val = '';
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          i++;
          if (line[i] === '"') {
            val += '"';
            i++;
          } else break;
        } else {
          val += line[i];
          i++;
        }
      }
      out.push(val);
      if (line[i] === ',') i++;
    } else {
      let val = '';
      while (i < line.length && line[i] !== ',') {
        val += line[i];
        i++;
      }
      out.push(val.trim());
      if (line[i] === ',') i++;
    }
  }
  return out;
}

function escapeCsv(val: string): string {
  if (/[,"\r\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}
