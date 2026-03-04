import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../settings/audit-log.service';
import * as bcrypt from 'bcrypt';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async createTenant(actorUserId: string, dto: CreateTenantDto) {
    const slug = dto.slug.trim().toLowerCase();
    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('Tenant slug already exists');
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name.trim(),
        slug,
        isActive: dto.isActive ?? true,
      },
    });
    await this.prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        brandName: dto.brandName?.trim() ?? null,
        primaryColour: dto.primaryColour?.trim() ?? null,
      },
    });
    await this.prisma.ticketSettings.create({
      data: { tenantId: tenant.id },
    });
    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'PLATFORM_CREATE_TENANT',
      entityType: 'Tenant',
      entityId: tenant.id,
      metadata: { slug: tenant.slug },
    });
    return tenant;
  }

  async findAll(query: ListTenantsQueryDto) {
    const where: Prisma.TenantWhereInput = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { slug: { contains: s, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { settings: true },
      }),
      this.prisma.tenant.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { settings: true, ticketSettings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async updateTenant(actorUserId: string, id: string, dto: UpdateTenantDto) {
    await this.findOne(id);
    if (dto.slug?.trim()) {
      const slug = dto.slug.trim().toLowerCase();
      const existing = await this.prisma.tenant.findFirst({
        where: { slug, id: { not: id } },
      });
      if (existing) throw new ConflictException('Tenant slug already exists');
    }
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.slug !== undefined) data.slug = dto.slug.trim().toLowerCase();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() ?? null;
    if (dto.plan !== undefined) data.plan = dto.plan?.trim() ?? null;
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: data as object,
    });
    await this.audit.log({
      tenantId: id,
      actorUserId,
      action: 'PLATFORM_UPDATE_TENANT',
      entityType: 'Tenant',
      entityId: id,
      metadata: data,
    });
    return tenant;
  }

  async createTenantAdmin(actorUserId: string, tenantId: string, dto: CreateTenantAdminDto) {
    await this.findOne(tenantId);
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) throw new ConflictException('User with this email already exists in tenant');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        displayName: dto.displayName?.trim() ?? null,
        passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
      select: { id: true, email: true, displayName: true, role: true, tenantId: true },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'PLATFORM_CREATE_TENANT_ADMIN',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email },
    });
    return user;
  }
}
