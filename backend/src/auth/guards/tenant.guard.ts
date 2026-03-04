import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Blocks request if user has no tenant context (e.g. platform admin not impersonating).
 * Use on tenant-scoped routes so platform admin must use impersonation to access them.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { tenantId?: string | null } | undefined;
    if (user?.tenantId == null || user.tenantId === '') {
      throw new ForbiddenException('Tenant context required');
    }
    return true;
  }
}
