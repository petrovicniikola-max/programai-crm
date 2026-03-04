import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class PlatformGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { isPlatformAdmin?: boolean } | undefined;
    if (!user?.isPlatformAdmin) {
      throw new ForbiddenException('Platform admin only');
    }
    return true;
  }
}
