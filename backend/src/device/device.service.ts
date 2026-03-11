import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DeviceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../settings/audit-log.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { ListDevicesQueryDto } from './dto/list-devices-query.dto';

@Injectable()
export class DeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateDeviceDto) {
    const serialNo = dto.serialNo?.trim() || null;
    if (serialNo) {
      const existing = await this.prisma.device.findUnique({
        where: { tenantId_serialNo: { tenantId, serialNo } },
      });
      if (existing) throw new ConflictException('Device with this serial number already exists');
    }
    const device = await this.prisma.device.create({
      data: {
        tenantId,
        companyId: dto.companyId || null,
        name: dto.name?.trim() || null,
        model: dto.model?.trim() || null,
        serialNo,
        status: dto.status ?? 'ACTIVE',
        notes: dto.notes?.trim() || null,
        testDevice: dto.testDevice ?? false,
        dpu: dto.dpu ?? false,
        sufEnvironment: dto.sufEnvironment?.trim() || null,
        eFakturaEnvironment: dto.eFakturaEnvironment?.trim() || null,
        paymentType: dto.paymentType?.trim() || null,
        accountSync: dto.accountSync?.trim() || null,
        teronPaymentGateway: dto.teronPaymentGateway ?? false,
        mdmProfileName: dto.mdmProfileName?.trim() || null,
      },
      include: { company: true },
    });
    await this.audit.log({
      tenantId,
      actorUserId: userId,
      action: 'CREATE_DEVICE',
      entityType: 'Device',
      entityId: device.id,
      metadata: { name: device.name, serialNo: device.serialNo },
    });
    return device;
  }

  async findAll(tenantId: string, query: ListDevicesQueryDto) {
    const where: {
      tenantId: string;
      companyId?: string;
      status?: DeviceStatus;
      serialNo?: { contains: string; mode: 'insensitive' };
      createdAt?: { gte?: Date; lte?: Date };
    } = { tenantId };
    if (query.companyId) where.companyId = query.companyId;
    if (query.status) where.status = query.status as DeviceStatus;
    if (query.search?.trim()) where.serialNo = { contains: query.search.trim(), mode: 'insensitive' };
    if (query.createdAtFrom || query.createdAtTo) {
      where.createdAt = {};
      if (query.createdAtFrom) where.createdAt.gte = new Date(query.createdAtFrom);
      if (query.createdAtTo) where.createdAt.lte = new Date(query.createdAtTo);
    }
    return this.prisma.device.findMany({
      where,
      include: { company: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const device = await this.prisma.device.findFirst({
      where: { id, tenantId },
      include: { company: true },
    });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateDeviceDto) {
    await this.findOne(tenantId, id);
    const serialNo = dto.serialNo !== undefined ? (dto.serialNo?.trim() || null) : undefined;
    if (serialNo !== undefined) {
      const existing = await this.prisma.device.findFirst({
        where: {
          tenantId,
          serialNo,
          id: { not: id },
        },
      });
      if (existing) throw new ConflictException('Device with this serial number already exists');
    }
    const data: Record<string, unknown> = {};
    if (dto.companyId !== undefined) data.companyId = dto.companyId || null;
    if (dto.name !== undefined) data.name = dto.name?.trim() || null;
    if (dto.model !== undefined) data.model = dto.model?.trim() || null;
    if (dto.serialNo !== undefined) data.serialNo = serialNo ?? undefined;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.testDevice !== undefined) data.testDevice = dto.testDevice;
    if (dto.dpu !== undefined) data.dpu = dto.dpu;
    if (dto.sufEnvironment !== undefined) data.sufEnvironment = dto.sufEnvironment?.trim() || null;
    if (dto.eFakturaEnvironment !== undefined) data.eFakturaEnvironment = dto.eFakturaEnvironment?.trim() || null;
    if (dto.paymentType !== undefined) data.paymentType = dto.paymentType?.trim() || null;
    if (dto.accountSync !== undefined) data.accountSync = dto.accountSync?.trim() || null;
    if (dto.teronPaymentGateway !== undefined) data.teronPaymentGateway = dto.teronPaymentGateway;
    if (dto.mdmProfileName !== undefined) data.mdmProfileName = dto.mdmProfileName?.trim() || null;
    const device = await this.prisma.device.update({
      where: { id },
      data: data as object,
      include: { company: true },
    });
    await this.audit.log({
      tenantId,
      actorUserId: userId,
      action: 'UPDATE_DEVICE',
      entityType: 'Device',
      entityId: id,
      metadata: data,
    });
    return device;
  }

  async remove(tenantId: string, userId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.device.delete({ where: { id } });
    await this.audit.log({
      tenantId,
      actorUserId: userId,
      action: 'DELETE_DEVICE',
      entityType: 'Device',
      entityId: id,
    });
    return { deleted: true };
  }

  async findLicences(tenantId: string, deviceId: string) {
    await this.findOne(tenantId, deviceId);
    return this.prisma.licence.findMany({
      where: { tenantId, deviceId },
      include: { company: true, device: true },
      orderBy: { validTo: 'asc' },
    });
  }

  async stats(tenantId: string) {
    const activeCount = await this.prisma.device.count({
      where: { tenantId, status: 'ACTIVE' },
    });
    return { activeCount };
  }

  /** CSV export with same filters as findAll */
  async exportCsv(tenantId: string, query: ListDevicesQueryDto): Promise<string> {
    const devices = await this.findAll(tenantId, query);
    const header = 'companyId,companyName,name,model,serialNo,status,notes,createdAt,updatedAt';
    const lines = devices.map(
      (d) =>
        [
          d.companyId ?? '',
          escapeCsv(d.company?.name ?? ''),
          escapeCsv(d.name ?? ''),
          escapeCsv(d.model ?? ''),
          escapeCsv(d.serialNo ?? ''),
          d.status,
          escapeCsv(d.notes ?? ''),
          d.createdAt.toISOString(),
          d.updatedAt.toISOString(),
        ].join(','),
    );
    return [header, ...lines].join('\r\n');
  }

  /** CSV template for import (header + one example row) */
  getImportTemplateCsv(): string {
    const header = 'companyId,companyName,name,model,serialNo,status,notes';
    const example = ',Moja Kompanija,Primer uređaj,Model X,SN001,ACTIVE,Primer napomena';
    return [header, example].join('\r\n');
  }

  /** Import devices from CSV file. Returns created count and per-row errors. */
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
      name: col('name'),
      model: col('model'),
      serialNo: col('serialNo'),
      status: col('status'),
      notes: col('notes'),
    };
    const statusSet = new Set<string>(['ACTIVE', 'INACTIVE', 'RETIRED']);

    for (let i = 0; i < dataLines.length; i++) {
      const rowNum = i + 2; // 1-based, + header
      const cells = parseCsvLine(dataLines[i]);
      const get = (k: keyof typeof idx) =>
        idx[k] >= 0 && cells[idx[k]] !== undefined ? String(cells[idx[k]]).trim() : '';
      const rawCompanyId = get('companyId') || null;
      const companyName = get('companyName') || null;
      const name = get('name') || null;
      const model = get('model') || null;
      const serialNo = get('serialNo') || null;
      const statusRaw = get('status') || 'ACTIVE';
      const status = statusSet.has(statusRaw) ? (statusRaw as DeviceStatus) : 'ACTIVE';
      const notes = get('notes') || null;

      let companyId: string | null = rawCompanyId;
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

      try {
        await this.create(tenantId, userId, {
          companyId: companyId || undefined,
          name: name || undefined,
          model: model || undefined,
          serialNo: serialNo || undefined,
          status,
          notes: notes || undefined,
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
