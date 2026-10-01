import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  fullPermissionMap,
  normalizePermissionEntry,
  PERMISSION_CATALOG,
  PermissionMap,
  SUPER_ADMIN_SLUG,
} from './permission-catalog';

type CacheEntry = { map: PermissionMap; version: number; expiresAt: number };

const CACHE_TTL_MS = 60_000;

@Injectable()
export class PermissionsService {
  private cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  invalidateCache(roleId?: string) {
    if (roleId) this.cache.delete(roleId);
    else this.cache.clear();
  }

  async getCatalog() {
    const rows = await this.prisma.permissionResource.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    if (rows.length > 0) return rows;
    return PERMISSION_CATALOG.map((r) => ({
      id: r.key,
      key: r.key,
      label: r.label,
      groupKey: r.groupKey,
      sortOrder: r.sortOrder,
    }));
  }

  async getRoleSlug(roleId: string | null | undefined): Promise<string | null> {
    if (!roleId) return null;
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { slug: true },
    });
    return role?.slug ?? null;
  }

  async resolveRoleIdFromSlug(slug: string): Promise<string | null> {
    const role = await this.prisma.role.findUnique({
      where: { slug },
      select: { id: true },
    });
    return role?.id ?? null;
  }

  async getPermissionsForRole(
    roleId: string | null | undefined,
    roleSlug?: string | null,
  ): Promise<PermissionMap> {
    if (roleSlug === SUPER_ADMIN_SLUG) return fullPermissionMap();

    if (!roleId) return {};

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { slug: true, permissionsVersion: true },
    });
    if (!role) return {};
    if (role.slug === SUPER_ADMIN_SLUG) return fullPermissionMap();

    const cached = this.cache.get(roleId);
    if (cached && cached.expiresAt > Date.now() && cached.version === role.permissionsVersion) {
      return cached.map;
    }

    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { resource: { select: { key: true } } },
    });

    const map: PermissionMap = {};
    for (const r of PERMISSION_CATALOG) {
      map[r.key] = { view: false, edit: false };
    }
    for (const row of rows) {
      const key = row.resource.key;
      map[key] = normalizePermissionEntry(row.canView, row.canEdit);
    }

    this.cache.set(roleId, {
      map,
      version: role.permissionsVersion,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return map;
  }

  async getPermissionsForUser(userId: string): Promise<{
    roleId: string | null;
    roleSlug: string | null;
    permissions: PermissionMap;
    permissionsVersion: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        roleId: true,
        assignedRole: { select: { slug: true, permissionsVersion: true } },
      },
    });
    if (!user) {
      return { roleId: null, roleSlug: null, permissions: {}, permissionsVersion: 0 };
    }

    const roleSlug = user.assignedRole?.slug ?? user.role;
    let roleId = user.roleId;
    if (!roleId) {
      roleId = await this.resolveRoleIdFromSlug(roleSlug);
    }

    const permissions = await this.getPermissionsForRole(roleId, roleSlug);
    return {
      roleId,
      roleSlug,
      permissions,
      permissionsVersion: user.assignedRole?.permissionsVersion ?? 0,
    };
  }

  async userHasPermission(
    userId: string,
    roleSlug: string | null | undefined,
    roleId: string | null | undefined,
    resource: string,
    action: 'view' | 'edit',
  ): Promise<boolean> {
    if (roleSlug === SUPER_ADMIN_SLUG) return true;
    const map = await this.getPermissionsForRole(roleId, roleSlug);
    const entry = map[resource];
    if (!entry) return false;
    return action === 'edit' ? entry.edit : entry.view;
  }
}
