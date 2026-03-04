import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUser {
  userId: string;
  tenantId: string | null;
  role: string;
  email: string;
  displayName?: string;
  isPlatformAdmin: boolean;
  isPlatformImpersonation?: boolean;
  actingAsUserId?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtUser | undefined, ctx: ExecutionContext): JwtUser | string | boolean | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtUser;
    if (data) {
      const value = user?.[data];
      return value === null ? undefined : value;
    }
    return user;
  },
);
