import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../settings/audit-log.service';

export interface JwtPayload {
  sub: string;
  tenantId: string | null;
  role: string;
  email: string;
  displayName?: string;
  isPlatformAdmin?: boolean;
  isPlatformImpersonation?: boolean;
  actingAsUserId?: string;
}

export interface LoginResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email: string; displayName?: string; tenantId: string | null; role: string; isPlatformAdmin: boolean };
}

const REFRESH_EXPIRY_DAYS = 7;
const IMPERSONATION_EXPIRY_MIN = 15;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<{ id: string; email: string; displayName?: string; tenantId: string | null; role: string; isPlatformAdmin: boolean } | null> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), isActive: true },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? undefined,
      tenantId: user.tenantId,
      role: user.role,
      isPlatformAdmin: user.isPlatformAdmin,
    };
  }

  async login(
    email: string,
    password: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<LoginResult> {
    const user = await this.validateUser(email, password);
    if (!user) {
      await this.audit.log({
        action: 'AUTH_LOGIN_FAILED',
        metadata: { email: email.trim().toLowerCase() },
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    const accessExpiresIn = this.config.get('JWT_EXPIRES_IN') ?? '60m';
    const access_token = this.jwt.sign({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      displayName: user.displayName,
      isPlatformAdmin: user.isPlatformAdmin,
    } as JwtPayload);
    const refreshTokenPlain = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRY_DAYS);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        tokenHash: hashToken(refreshTokenPlain),
        expiresAt,
      },
    });
    const expiresInSec = typeof accessExpiresIn === 'string' ? (accessExpiresIn.endsWith('m') ? parseInt(accessExpiresIn, 10) * 60 : parseInt(accessExpiresIn, 10)) : 3600;
    await this.audit.log({
      tenantId: user.tenantId ?? undefined,
      actorUserId: user.id,
      action: 'AUTH_LOGIN',
      metadata: { email: user.email },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    return {
      access_token,
      refresh_token: refreshTokenPlain,
      expires_in: expiresInSec,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        tenantId: user.tenantId,
        role: user.role,
        isPlatformAdmin: user.isPlatformAdmin,
      },
    };
  }

  async refresh(
    refreshToken: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<{ access_token: string; expires_in: number }> {
    const hash = hashToken(refreshToken);
    const row = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: hash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!row) throw new UnauthorizedException('Invalid or expired refresh token');
    const user = row.user;
    if (!user.isActive) throw new UnauthorizedException('User inactive');
    const accessExpiresIn = this.config.get('JWT_EXPIRES_IN') ?? '60m';
    const access_token = this.jwt.sign({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      displayName: user.displayName ?? undefined,
      isPlatformAdmin: user.isPlatformAdmin,
    } as JwtPayload);
    const expiresInSec = typeof accessExpiresIn === 'string' ? (accessExpiresIn.endsWith('m') ? parseInt(accessExpiresIn, 10) * 60 : parseInt(accessExpiresIn, 10)) : 3600;
    await this.audit.log({
      tenantId: user.tenantId ?? undefined,
      actorUserId: user.id,
      action: 'AUTH_REFRESH',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    return { access_token, expires_in: expiresInSec };
  }

  async logout(refreshToken: string) {
    const hash = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash },
      data: { revokedAt: new Date() },
    });
  }

  async impersonate(platformAdminId: string, tenantId: string, userId?: string): Promise<{ access_token: string; expires_in: number }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');
    let sub: string;
    let email: string;
    let displayName: string | undefined;
    let role: string;
    if (userId) {
      const target = await this.prisma.user.findFirst({
        where: { id: userId, tenantId, isActive: true },
      });
      if (!target) throw new BadRequestException('User not found in tenant');
      sub = target.id;
      email = target.email;
      displayName = target.displayName ?? undefined;
      role = target.role;
    } else {
      const admin = await this.prisma.user.findUnique({
        where: { id: platformAdminId },
      });
      if (!admin?.isPlatformAdmin) throw new UnauthorizedException('Not platform admin');
      sub = admin.id;
      email = admin.email;
      displayName = admin.displayName ?? undefined;
      role = 'SUPER_ADMIN';
    }
    const expiresInMin = IMPERSONATION_EXPIRY_MIN;
    const access_token = this.jwt.sign(
      {
        sub,
        tenantId,
        role,
        email,
        displayName,
        isPlatformAdmin: false,
        isPlatformImpersonation: true,
        actingAsUserId: platformAdminId,
      } as JwtPayload,
      { expiresIn: `${expiresInMin}m` },
    );
    await this.audit.log({
      tenantId,
      actorUserId: platformAdminId,
      actingAsUserId: userId ?? sub,
      isImpersonation: true,
      action: 'PLATFORM_IMPERSONATE',
      entityType: 'User',
      entityId: sub,
      metadata: { tenantId, targetUserId: sub },
    });
    return { access_token, expires_in: expiresInMin * 60 };
  }

  async forgotPassword(email: string, meta?: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), isActive: true },
    });
    if (!user) return;
    const tokenPlain = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        tokenHash: hashToken(tokenPlain),
        expiresAt,
      },
    });
    if (!process.env.SMTP_HOST) {
      console.log('[Password reset] Token for', user.email, '(dev):', tokenPlain);
    }
    await this.audit.log({
      tenantId: user.tenantId ?? undefined,
      actorUserId: user.id,
      action: 'PASSWORD_RESET_REQUEST',
      metadata: { email: user.email },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    if (process.env.SMTP_HOST) {
      // TODO: send email with reset link containing tokenPlain
    }
  }

  async resetPassword(token: string, newPassword: string, meta?: { ip?: string; userAgent?: string }) {
    const hash = hashToken(token);
    const row = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash: hash, usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!row) throw new UnauthorizedException('Invalid or expired reset token');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    });
    await this.prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    await this.audit.log({
      tenantId: row.user.tenantId ?? undefined,
      actorUserId: row.userId,
      action: 'PASSWORD_RESET_COMPLETE',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, role: true, tenantId: true, isPlatformAdmin: true, createdAt: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  async getTenantUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, email: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });
  }
}
