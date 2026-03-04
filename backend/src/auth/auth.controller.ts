import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TenantGuard } from './guards/tenant.guard';
import { CurrentUser } from './decorators/current-user.decorator';

function meta(req: Request) {
  return {
    ip: (req as Request & { ip?: string }).ip ?? req.socket?.remoteAddress,
    userAgent: req.get('user-agent'),
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto.email, dto.password, meta(req));
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Exchange refresh token for new access token' })
  async refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.authService.refresh(dto.refresh_token, meta(req));
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke refresh token' })
  async logout(@Body() dto: LogoutDto) {
    await this.authService.logout(dto.refresh_token);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Request password reset (sends email or logs token in dev)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    await this.authService.forgotPassword(dto.email, meta(req));
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token from email' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    await this.authService.resetPassword(dto.token, dto.newPassword, meta(req));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  async me(@CurrentUser('userId') userId: string) {
    return this.authService.me(userId);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List tenant users (id, email, displayName) for filters' })
  async getUsers(@CurrentUser('tenantId') tenantId: string) {
    return this.authService.getTenantUsers(tenantId);
  }
}
