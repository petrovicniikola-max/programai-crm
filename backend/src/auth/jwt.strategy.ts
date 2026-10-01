import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from './auth.service';
import { PermissionsService } from '../permissions/permissions.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly permissions: PermissionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'change-me-in-production'),
    });
  }

  async validate(payload: JwtPayload) {
    const permCtx = await this.permissions.getPermissionsForUser(payload.sub);
    return {
      userId: payload.sub,
      tenantId: payload.tenantId ?? null,
      role: permCtx.roleSlug ?? payload.role,
      roleId: permCtx.roleId ?? payload.roleId ?? null,
      email: payload.email,
      displayName: payload.displayName,
      isPlatformAdmin: payload.isPlatformAdmin ?? false,
      isPlatformImpersonation: payload.isPlatformImpersonation ?? false,
      actingAsUserId: payload.actingAsUserId,
    };
  }
}
