import { Controller, Post, Get, Put, Body, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { promises as fs } from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DashboardLayoutDto } from './dto/dashboard-layout.dto';
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

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for the current user' })
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.authService.changePassword(userId, dto.currentPassword, dto.newPassword, meta(req));
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload current user profile photo' })
  async uploadAvatar(
    @CurrentUser('userId') userId: string,
    @CurrentUser('tenantId') tenantId: string | null,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string },
  ) {
    if (!file) throw new BadRequestException('Slika je obavezna');
    if (!/^image\/(png|jpe?g)$/i.test(file.mimetype)) {
      throw new BadRequestException('Dozvoljene su samo PNG i JPG slike');
    }
    const image = sharp(file.buffer);
    const info = await image.metadata();
    if (!info.width || !info.height) throw new BadRequestException('Slika nije ispravna');

    const scope = tenantId || 'platform';
    const uploadsRoot = path.join(process.cwd(), 'uploads', 'tenants', scope, 'avatars');
    await fs.mkdir(uploadsRoot, { recursive: true });
    const filePath = path.join(uploadsRoot, `${userId}.png`);
    await image.resize({ width: 256, height: 256, fit: 'cover' }).png().toFile(filePath);
    const publicUrl = `/uploads/tenants/${scope}/avatars/${userId}.png?v=${Date.now()}`;
    return this.authService.setAvatar(userId, publicUrl);
  }

  @Get('dashboard-layout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user dashboard layout' })
  async getDashboardLayout(@CurrentUser('userId') userId: string) {
    return this.authService.getDashboardLayout(userId);
  }

  @Put('dashboard-layout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save current user dashboard layout' })
  async setDashboardLayout(
    @CurrentUser('userId') userId: string,
    @Body() dto: DashboardLayoutDto,
  ) {
    return this.authService.setDashboardLayout(userId, dto);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List tenant users (id, email, displayName) for filters' })
  async getUsers(@CurrentUser('tenantId') tenantId: string) {
    return this.authService.getTenantUsers(tenantId);
  }
}
