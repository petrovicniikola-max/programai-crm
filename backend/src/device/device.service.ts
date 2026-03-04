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
    const where: { tenantId: string; companyId?: string; status?: DeviceStatus; serialNo?: { contains: string; mode: 'insensitive' } } = {
      tenantId,
    };
    if (query.companyId) where.companyId = query.companyId;
    if (query.status) where.status = query.status as DeviceStatus;
    if (query.search?.trim()) where.serialNo = { contains: query.search.trim(), mode: 'insensitive' };
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
}
