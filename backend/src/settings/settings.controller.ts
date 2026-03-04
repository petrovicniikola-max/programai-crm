import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  Header,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtUser } from '../auth/decorators/current-user.decorator';
import { SettingsBrandingService } from './settings-branding.service';
import { SettingsUsersService } from './settings-users.service';
import { SettingsTicketSettingsService } from './settings-ticket-settings.service';
import { SettingsNotificationsService } from './settings-notifications.service';
import { SettingsSecurityService } from './settings-security.service';
import { SettingsEmailService } from './settings-email.service';
import { SettingsExportService } from './settings-export.service';
import { AuditLogService } from './audit-log.service';
import { TagService } from '../tag/tag.service';
import { PatchBrandingDto } from './dto/branding.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetUserPasswordDto } from './dto/set-user-password.dto';
import { PatchTicketSettingsDto } from './dto/ticket-settings.dto';
import { PatchNotificationsDto } from './dto/notifications.dto';
import { PatchSecurityDto } from './dto/security.dto';
import { PatchEmailSettingsDto } from './dto/email-settings.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import sharp from 'sharp';
import * as path from 'path';
import { promises as fs } from 'fs';

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(
    private readonly branding: SettingsBrandingService,
    private readonly users: SettingsUsersService,
    private readonly ticketSettings: SettingsTicketSettingsService,
    private readonly notifications: SettingsNotificationsService,
    private readonly security: SettingsSecurityService,
    private readonly emailSettings: SettingsEmailService,
    private readonly exportService: SettingsExportService,
    private readonly audit: AuditLogService,
    private readonly tagService: TagService,
  ) {}

  @Get('branding')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get branding (SUPER_ADMIN only)' })
  getBranding(@CurrentUser('tenantId') tenantId: string) {
    return this.branding.get(tenantId);
  }

  @Patch('branding')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update branding' })
  patchBranding(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: PatchBrandingDto,
  ) {
    return this.branding.patch(tenantId, userId, dto);
  }

  @Post('branding/logo')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    }),
  )
  @ApiOperation({ summary: 'Upload branding logo image (jpg/png, auto-resize to max 250x150)' })
  async uploadBrandingLogo(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @UploadedFile() file?: any,
  ) {
    if (!file) {
      throw new BadRequestException('Logo file is required (field name: "file")');
    }
    if (!/^image\/(png|jpe?g)$/i.test(file.mimetype)) {
      throw new BadRequestException('Only PNG and JPG/JPEG images are allowed');
    }

    const image = sharp(file.buffer);
    const meta = await image.metadata();
    if (!meta.width || !meta.height) {
      throw new BadRequestException('Invalid image');
    }

    const MAX_WIDTH = 250;
    const MAX_HEIGHT = 150;
    let pipeline = image;
    if (meta.width > MAX_WIDTH || meta.height > MAX_HEIGHT) {
      pipeline = image.resize({
        width: MAX_WIDTH,
        height: MAX_HEIGHT,
        fit: 'inside',
      });
    }

    const uploadsRoot = path.join(process.cwd(), 'uploads', 'tenants', tenantId, 'branding');
    await fs.mkdir(uploadsRoot, { recursive: true });
    const filePath = path.join(uploadsRoot, 'logo.png');
    await pipeline.png().toFile(filePath);

    const publicUrl = `/uploads/tenants/${tenantId}/branding/logo.png`;
    return this.branding.patch(tenantId, userId, { logoUrl: publicUrl });
  }

  @Get('users')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List users (SUPER_ADMIN only)' })
  getUsers(@CurrentUser('tenantId') tenantId: string) {
    return this.users.findAll(tenantId);
  }

  @Post('users')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create user' })
  createUser(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateUserDto,
  ) {
    return this.users.create(tenantId, userId, dto);
  }

  @Patch('users/:id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update user' })
  updateUser(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(tenantId, userId, id, dto);
  }

  @Post('users/:id/reset-password')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Reset user password' })
  resetPassword(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: SetUserPasswordDto,
  ) {
    return this.users.resetPassword(tenantId, userId, id, dto);
  }

  @Get('tickets')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get ticket settings (SUPER_ADMIN only)' })
  getTicketSettings(@CurrentUser('tenantId') tenantId: string) {
    return this.ticketSettings.get(tenantId);
  }

  @Patch('tickets')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update ticket settings' })
  patchTicketSettings(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: PatchTicketSettingsDto,
  ) {
    return this.ticketSettings.patch(tenantId, userId, dto);
  }

  @Get('tags')
  @ApiOperation({ summary: 'List tags (SUPPORT/SALES can read)' })
  getTags(@CurrentUser('tenantId') tenantId: string) {
    return this.tagService.findAll(tenantId);
  }

  @Post('tags')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create tag (SUPER_ADMIN only)' })
  async createTag(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateTagDto,
  ) {
    const tag = await this.tagService.create(tenantId, dto.name);
    await this.audit.log({
      tenantId,
      actorUserId: userId,
      action: 'CREATE_TAG',
      entityType: 'Tag',
      entityId: tag.id,
      metadata: { name: tag.name },
    });
    return tag;
  }

  @Delete('tags/:id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete tag (SUPER_ADMIN only)' })
  async deleteTag(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    const tag = await this.tagService.remove(tenantId, id);
    await this.audit.log({
      tenantId,
      actorUserId: userId,
      action: 'DELETE_TAG',
      entityType: 'Tag',
      entityId: id,
    });
    return tag;
  }

  @Get('notifications')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get notifications config (SUPER_ADMIN only)' })
  getNotifications(@CurrentUser('tenantId') tenantId: string) {
    return this.notifications.get(tenantId);
  }

  @Patch('notifications')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update notifications config' })
  patchNotifications(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: PatchNotificationsDto,
  ) {
    return this.notifications.patch(tenantId, userId, dto);
  }

  @Get('export/companies.csv')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @Header('Content-Type', 'text/csv')
  @ApiOperation({ summary: 'Export companies CSV (SUPER_ADMIN only)' })
  async exportCompaniesCsv(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.companiesCsv(tenantId);
    await this.audit.log({
      tenantId,
      actorUserId: user?.userId,
      action: 'EXPORT_CSV',
      entityType: 'Export',
      metadata: { type: 'companies' },
    });
    res.send(csv);
  }

  @Get('export/contacts.csv')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @Header('Content-Type', 'text/csv')
  @ApiOperation({ summary: 'Export contacts CSV (SUPER_ADMIN only)' })
  async exportContactsCsv(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.contactsCsv(tenantId);
    await this.audit.log({
      tenantId,
      actorUserId: user?.userId,
      action: 'EXPORT_CSV',
      entityType: 'Export',
      metadata: { type: 'contacts' },
    });
    res.send(csv);
  }

  @Get('export/tickets.csv')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @Header('Content-Type', 'text/csv')
  @ApiOperation({ summary: 'Export tickets CSV (SUPER_ADMIN only)' })
  async exportTicketsCsv(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.ticketsCsv(tenantId);
    await this.audit.log({
      tenantId,
      actorUserId: user?.userId,
      action: 'EXPORT_CSV',
      entityType: 'Export',
      metadata: { type: 'tickets' },
    });
    res.send(csv);
  }

  @Get('export/forms.csv')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @Header('Content-Type', 'text/csv')
  @ApiOperation({ summary: 'Export forms list CSV (SUPER_ADMIN only). Optional formIds=id1,id2 to export only selected.' })
  @ApiQuery({ name: 'formIds', required: false, description: 'Comma-separated form IDs to export only those' })
  async exportFormsCsv(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser() user: JwtUser,
    @Query('formIds') formIdsQuery: string | undefined,
    @Res() res: Response,
  ) {
    const formIds = formIdsQuery?.trim()
      ? formIdsQuery.split(',').map((id) => id.trim()).filter(Boolean)
      : undefined;
    const csv = await this.exportService.formsCsv(tenantId, formIds);
    await this.audit.log({
      tenantId,
      actorUserId: user?.userId,
      action: 'EXPORT_CSV',
      entityType: 'Export',
      metadata: { type: 'forms', formIds: formIds ?? 'all' },
    });
    res.send(csv);
  }

  @Get('email')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get email/sending config (SUPER_ADMIN only). Password never returned.' })
  getEmailSettings(@CurrentUser('tenantId') tenantId: string) {
    return this.emailSettings.get(tenantId);
  }

  @Patch('email')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update email sending: address, provider (Google/M365), password (optional)' })
  patchEmailSettings(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: PatchEmailSettingsDto,
  ) {
    return this.emailSettings.patch(tenantId, userId, dto);
  }

  @Get('security')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get security config (SUPER_ADMIN only)' })
  getSecurity(@CurrentUser('tenantId') tenantId: string) {
    return this.security.get(tenantId);
  }

  @Patch('security')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update security (jwtAccessTtlMinutes; TODO apply at token issue)' })
  patchSecurity(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: PatchSecurityDto,
  ) {
    return this.security.patch(tenantId, userId, dto);
  }

  @Get('audit')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get audit log (SUPER_ADMIN only)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getAudit(
    @CurrentUser('tenantId') tenantId: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50;
    return this.audit.findAll(tenantId, n);
  }
}
