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
}
