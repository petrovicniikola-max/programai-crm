import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'change-me-in-production'),
    });
  }

  async validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      tenantId: payload.tenantId ?? null,
      role: payload.role,
      email: payload.email,
      displayName: payload.displayName,
      isPlatformAdmin: payload.isPlatformAdmin ?? false,
      isPlatformImpersonation: payload.isPlatformImpersonation ?? false,
      actingAsUserId: payload.actingAsUserId,
    };
  }
}
