import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from './decorators/require-permission.decorator';
import { PermissionsService } from './permissions.service';
import { SUPER_ADMIN_SLUG } from './permission-catalog';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<{ resource: string; action: 'view' | 'edit' }>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.userId) return false;
    if (user.role === SUPER_ADMIN_SLUG) return true;

    return this.permissions.userHasPermission(
      user.userId,
      user.role,
      user.roleId,
      meta.resource,
      meta.action,
    );
  }
}
