import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../settings/audit-log.service';
import { PermissionsService } from './permissions.service';
import {
  emptyPermissionMap,
  normalizePermissionEntry,
  PERMISSION_CATALOG,
  SUPER_ADMIN_SLUG,
} from './permission-catalog';
import { CreateRoleDto, UpdateRoleDto, UpdateRolePermissionsDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditLogService,
  ) {}

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { users: true } } },
    });
    return roles.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      isActive: r.isActive,
      sortOrder: r.sortOrder,
      userCount: r._count.users,
    }));
  }

  async createRole(tenantId: string, actorUserId: string, dto: CreateRoleDto) {
    const slug = dto.slug.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!slug) throw new BadRequestException('Slug uloge je obavezan.');
    const existing = await this.prisma.role.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('Uloga sa tim slug-om već postoji.');

    const resources = await this.prisma.permissionResource.findMany();
    const role = await this.prisma.role.create({
      data: {
        slug,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        isSystem: false,
        isActive: true,
        sortOrder: dto.sortOrder ?? 100,
      },
    });

    if (resources.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: resources.map((res) => ({
          roleId: role.id,
          resourceId: res.id,
          canView: false,
          canEdit: false,
        })),
      });
    }

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'CREATE_ROLE',
      entityType: 'Role',
      entityId: role.id,
      metadata: { slug: role.slug, name: role.name },
    });

    return role;
  }

  async updateRole(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateRoleDto,
  ) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Uloga nije pronađena.');
    if (role.isSystem && dto.isActive === false) {
      throw new BadRequestException('Sistemsku ulogu nije moguće deaktivirati.');
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder != null ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'UPDATE_ROLE',
      entityType: 'Role',
      entityId: id,
      metadata: dto as object,
    });

    return updated;
  }

  async deleteRole(tenantId: string, actorUserId: string, id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Uloga nije pronađena.');
    if (role.isSystem) throw new BadRequestException('Sistemsku ulogu nije moguće obrisati.');
    if (role._count.users > 0) {
      throw new BadRequestException('Uloga je dodeljena korisnicima — prvo prebacite korisnike.');
    }

    await this.prisma.role.delete({ where: { id } });
    this.permissions.invalidateCache(id);

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'DELETE_ROLE',
      entityType: 'Role',
      entityId: id,
      metadata: { slug: role.slug },
    });

    return { ok: true };
  }

  async getRolePermissions(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Uloga nije pronađena.');

    if (role.slug === SUPER_ADMIN_SLUG) {
      const resources = await this.getCatalogRows();
      return {
        roleId: role.id,
        slug: role.slug,
        isSystem: role.isSystem,
        readOnly: true,
        permissions: resources.map((res) => ({
          resourceKey: res.key,
          label: res.label,
          groupKey: res.groupKey,
          canView: true,
          canEdit: true,
        })),
      };
    }

    const resources = await this.getCatalogRows();
    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { resource: true },
    });
    const byKey = new Map(rows.map((r) => [r.resource.key, r]));

    const permissions = resources.map((res) => {
      const row = byKey.get(res.key);
      const normalized = normalizePermissionEntry(
        row?.canView ?? false,
        row?.canEdit ?? false,
      );
      return {
        resourceKey: res.key,
        label: res.label,
        groupKey: res.groupKey,
        canView: normalized.view,
        canEdit: normalized.edit,
      };
    });

    return {
      roleId: role.id,
      slug: role.slug,
      isSystem: role.isSystem,
      readOnly: false,
      permissions,
    };
  }

  async updateRolePermissions(
    tenantId: string,
    actorUserId: string,
    roleId: string,
    dto: UpdateRolePermissionsDto,
  ) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Uloga nije pronađena.');
    if (role.slug === SUPER_ADMIN_SLUG) {
      throw new BadRequestException('Permisije SUPER_ADMIN uloge se ne menjaju.');
    }

    const resources = await this.prisma.permissionResource.findMany();
    const resourceByKey = new Map(resources.map((r) => [r.key, r]));

    for (const item of dto.permissions) {
      const resource = resourceByKey.get(item.resourceKey);
      if (!resource) continue;
      const normalized = normalizePermissionEntry(item.canView, item.canEdit);
      await this.prisma.rolePermission.upsert({
        where: {
          roleId_resourceId: { roleId, resourceId: resource.id },
        },
        create: {
          roleId,
          resourceId: resource.id,
          canView: normalized.view,
          canEdit: normalized.edit,
        },
        update: {
          canView: normalized.view,
          canEdit: normalized.edit,
        },
      });
    }

    await this.prisma.role.update({
      where: { id: roleId },
      data: { permissionsVersion: { increment: 1 } },
    });
    this.permissions.invalidateCache(roleId);

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'UPDATE_ROLE_PERMISSIONS',
      entityType: 'Role',
      entityId: roleId,
      metadata: { slug: role.slug, count: dto.permissions.length },
    });

    return this.getRolePermissions(roleId);
  }

  /** Sync User.role enum from roleId (dual-write). */
  async syncUserRoleEnum(userId: string, roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return;
    const enumVal = role.slug as UserRole;
    const valid = Object.values(UserRole).includes(enumVal);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        roleId,
        ...(valid ? { role: enumVal } : {}),
      },
    });
  }

  async resolveRoleForAssignment(roleId?: string, roleSlug?: string) {
    if (roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: roleId } });
      if (!role) throw new NotFoundException('Uloga nije pronađena.');
      if (!role.isActive) throw new BadRequestException('Uloga nije aktivna.');
      return role;
    }
    if (roleSlug) {
      const role = await this.prisma.role.findUnique({ where: { slug: roleSlug } });
      if (!role) throw new NotFoundException('Uloga nije pronađena.');
      return role;
    }
    throw new BadRequestException('roleId ili role je obavezan.');
  }

  private async getCatalogRows() {
    const rows = await this.prisma.permissionResource.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    if (rows.length > 0) return rows;
    return PERMISSION_CATALOG.map((r, i) => ({
      id: `catalog_${r.key}`,
      key: r.key,
      label: r.label,
      groupKey: r.groupKey,
      sortOrder: r.sortOrder ?? i,
    }));
  }
}
