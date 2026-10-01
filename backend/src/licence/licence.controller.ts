import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Res,
  Header,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { LicenceService } from './licence.service';
import { LicenceAlertsService } from './licence-alerts.service';
import { CreateLicenceDto } from './dto/create-licence.dto';
import { UpdateLicenceDto } from './dto/update-licence.dto';
import { RenewLicenceDto } from './dto/renew-licence.dto';
import { ListLicencesQueryDto } from './dto/list-licences-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('licences')
@Controller('licences')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class LicenceController {
  constructor(
    private readonly licenceService: LicenceService,
    private readonly alertsService: LicenceAlertsService,
  ) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('licences', 'edit')
  @ApiOperation({ summary: 'Create licence' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateLicenceDto,
  ) {
    return this.licenceService.create(tenantId, userId, dto);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('licences', 'view')
  @ApiOperation({ summary: 'List licences' })
  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ListLicencesQueryDto) {
    return this.licenceService.findAll(tenantId, query);
  }

  @Get('expiring-soon')
  @UseGuards(PermissionsGuard)
  @RequirePermission('licences', 'view')
  @ApiOperation({ summary: 'Licences expiring in the next N days' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  expiringSoon(
    @CurrentUser('tenantId') tenantId: string,
    @Query('days') days?: string,
  ) {
    const n = days ? Math.min(Math.max(parseInt(days, 10) || 30, 1), 365) : 30;
    return this.licenceService.expiringSoon(tenantId, n);
  }

  @Post('alerts/run-now')
  @UseGuards(PermissionsGuard)
  @RequirePermission('licences', 'edit')
  @ApiOperation({ summary: 'Manually trigger licence expiry alert scan (SUPER_ADMIN)' })
  runAlertsNow(@CurrentUser('tenantId') tenantId: string, @CurrentUser('userId') userId: string) {
    return this.alertsService.runNow(userId);
  }

  @Get('alerts/logs')
  @UseGuards(PermissionsGuard)
  @RequirePermission('licences', 'view')
  @ApiOperation({ summary: 'List licence notification logs (SUPER_ADMIN)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  getAlertLogs(
    @CurrentUser('tenantId') tenantId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50;
    const skip = offset ? Math.max(0, parseInt(offset, 10)) : 0;
    return this.alertsService.getLogs(tenantId, take, skip);
  }

  @Get('export')
  @UseGuards(PermissionsGuard)
  @RequirePermission('licences', 'view')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export licences as CSV' })
  @ApiQuery({ name: 'format', required: false, enum: ['csv'] })
  async exportCsv(
    @CurrentUser('tenantId') tenantId: string,
    @Res() res: Response,
    @Query() query: ListLicencesQueryDto,
  ) {
    const csv = await this.licenceService.exportCsv(tenantId, query);
    const filename = `licences_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('import/template')
  @UseGuards(PermissionsGuard)
  @RequirePermission('licences', 'view')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Download sample CSV for licence import' })
  getImportTemplate(@Res() res: Response) {
    const csv = this.licenceService.getImportTemplateCsv();
    res.setHeader('Content-Disposition', 'attachment; filename="licences_import_primer.csv"');
    res.send(csv);
  }

  @Get('stats')
  @UseGuards(PermissionsGuard)
  @RequirePermission('licences', 'view')
  @ApiOperation({ summary: 'Licence stats for dashboard' })
  stats(@CurrentUser('tenantId') tenantId: string) {
    return this.licenceService.stats(tenantId);
  }

  @Post('import')
  @UseGuards(PermissionsGuard)
  @RequirePermission('licences', 'edit')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Import licences from CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  async importCsv(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    if (!file?.buffer) throw new BadRequestException('Fajl je obavezan (polje "file")');
    return this.licenceService.importFromCsv(tenantId, userId, file.buffer);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('licences', 'view')
  @ApiOperation({ summary: 'Get licence by id' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.licenceService.findOne(tenantId, id);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('licences', 'edit')
  @ApiOperation({ summary: 'Update licence' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLicenceDto,
  ) {
    return this.licenceService.update(tenantId, userId, id, dto);
  }

  @Post(':id/renew')
  @UseGuards(PermissionsGuard)
  @RequirePermission('licences', 'edit')
  @ApiOperation({ summary: 'Renew licence (set validTo + RENEWED event)' })
  renew(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: RenewLicenceDto,
  ) {
    return this.licenceService.renew(tenantId, userId, id, dto);
  }
}
