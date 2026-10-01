import {

  Controller,

  Get,

  Post,

  Body,

  Patch,

  Param,

  Delete,

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

import { DeviceService } from './device.service';

import {

  DeviceTeronImportService,

  TERON_IMPORT_MAX_ROWS,

} from './device-teron-import.service';

import { CreateDeviceDto } from './dto/create-device.dto';

import { UpdateDeviceDto } from './dto/update-device.dto';

import { ListDevicesQueryDto } from './dto/list-devices-query.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { TenantGuard } from '../auth/guards/tenant.guard';

import { PermissionsGuard } from '../permissions/permissions.guard';

import { RequirePermission } from '../permissions/decorators/require-permission.decorator';

import { CurrentUser } from '../auth/decorators/current-user.decorator';



const IMPORT_FILE_LIMIT = 20 * 1024 * 1024;

const TERON_IMPORT_FILE_LIMIT = 50 * 1024 * 1024;



@ApiTags('devices')

@Controller('devices')

@UseGuards(JwtAuthGuard, TenantGuard)

@ApiBearerAuth()

export class DeviceController {

  constructor(

    private readonly deviceService: DeviceService,

    private readonly teronImportService: DeviceTeronImportService,

  ) {}



  @Get('export')

  @UseGuards(PermissionsGuard)

  @RequirePermission('devices', 'edit')

  @Header('Content-Type', 'text/csv; charset=utf-8')

  @ApiOperation({ summary: 'Export devices as CSV' })

  @ApiQuery({ name: 'format', required: false, enum: ['csv'] })

  async exportCsv(

    @CurrentUser('tenantId') tenantId: string,

    @Res() res: Response,

    @Query() query: ListDevicesQueryDto,

  ) {

    const csv = await this.deviceService.exportCsv(tenantId, query);

    const filename = `devices_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(csv);

  }



  @Get('import/template')

  @UseGuards(PermissionsGuard)

  @RequirePermission('devices', 'edit')

  @Header('Content-Type', 'text/csv; charset=utf-8')

  @ApiOperation({ summary: 'Download sample CSV for device import' })

  getImportTemplate(@Res() res: Response) {

    const csv = this.deviceService.getImportTemplateCsv();

    res.setHeader('Content-Disposition', 'attachment; filename="devices_import_primer.csv"');

    res.send(csv);

  }



  @Post('import')

  @UseGuards(PermissionsGuard)

  @RequirePermission('devices', 'edit')

  @UseInterceptors(

    FileInterceptor('file', {

      storage: memoryStorage(),

      limits: { fileSize: IMPORT_FILE_LIMIT },

    }),

  )

  @ApiOperation({ summary: 'Import devices from CSV file (max 25000 rows)' })

  @ApiConsumes('multipart/form-data')

  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })

  async importCsv(

    @CurrentUser('tenantId') tenantId: string,

    @CurrentUser('userId') userId: string,

    @UploadedFile() file?: { buffer: Buffer },

  ) {

    if (!file?.buffer) throw new BadRequestException('Fajl je obavezan (polje "file")');

    return this.deviceService.importFromCsv(tenantId, userId, file.buffer);

  }



  @Post('import/teron-xlsx')

  @UseGuards(PermissionsGuard)

  @RequirePermission('devices', 'edit')

  @UseInterceptors(

    FileInterceptor('file', {

      storage: memoryStorage(),

      limits: { fileSize: TERON_IMPORT_FILE_LIMIT },

    }),

  )

  @ApiOperation({

    summary: `Import Teron export (xlsx): devices, companies, distributors, licences (max ${TERON_IMPORT_MAX_ROWS} rows)`,

  })

  @ApiConsumes('multipart/form-data')

  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })

  async importTeronXlsx(

    @CurrentUser('tenantId') tenantId: string,

    @CurrentUser('userId') userId: string,

    @UploadedFile() file?: { buffer: Buffer; originalname?: string },

  ) {

    if (!file?.buffer) throw new BadRequestException('Fajl je obavezan (polje "file")');

    const name = file.originalname?.toLowerCase() ?? '';

    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {

      throw new BadRequestException('Očekivan Excel fajl (.xlsx)');

    }

    return this.teronImportService.importFromExcel(tenantId, userId, file.buffer);

  }



  @Get('stats')

  @UseGuards(PermissionsGuard)

  @RequirePermission('devices', 'view')

  @ApiOperation({ summary: 'Device stats for dashboard' })

  stats(@CurrentUser('tenantId') tenantId: string) {

    return this.deviceService.stats(tenantId);

  }



  @Post()

  @UseGuards(PermissionsGuard)

  @RequirePermission('devices', 'edit')

  @ApiOperation({ summary: 'Create device' })

  create(

    @CurrentUser('tenantId') tenantId: string,

    @CurrentUser('userId') userId: string,

    @Body() dto: CreateDeviceDto,

  ) {

    return this.deviceService.create(tenantId, userId, dto);

  }



  @Get()

  @UseGuards(PermissionsGuard)

  @RequirePermission('devices', 'view')

  @ApiOperation({ summary: 'List devices' })

  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ListDevicesQueryDto) {

    return this.deviceService.findAll(tenantId, query);

  }



  @Get(':id')

  @UseGuards(PermissionsGuard)

  @RequirePermission('devices', 'view')

  @ApiOperation({ summary: 'Get device by id' })

  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {

    return this.deviceService.findOne(tenantId, id);

  }



  @Patch(':id')

  @UseGuards(PermissionsGuard)

  @RequirePermission('devices', 'edit')

  @ApiOperation({ summary: 'Update device' })

  update(

    @CurrentUser('tenantId') tenantId: string,

    @CurrentUser('userId') userId: string,

    @Param('id') id: string,

    @Body() dto: UpdateDeviceDto,

  ) {

    return this.deviceService.update(tenantId, userId, id, dto);

  }



  @Delete(':id')

  @UseGuards(PermissionsGuard)

  @RequirePermission('devices', 'edit')

  @ApiOperation({ summary: 'Delete device' })

  remove(

    @CurrentUser('tenantId') tenantId: string,

    @CurrentUser('userId') userId: string,

    @Param('id') id: string,

  ) {

    return this.deviceService.remove(tenantId, userId, id);

  }



  @Get(':id/licences')

  @UseGuards(PermissionsGuard)

  @RequirePermission('devices', 'view')

  @ApiOperation({ summary: 'List licences attached to device' })

  findLicencesForDevice(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {

    return this.deviceService.findLicences(tenantId, id);

  }

}


