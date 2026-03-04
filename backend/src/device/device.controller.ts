import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeviceService } from './device.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { ListDevicesQueryDto } from './dto/list-devices-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('devices')
@Controller('devices')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SUPPORT')
  @ApiOperation({ summary: 'Create device' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateDeviceDto,
  ) {
    return this.deviceService.create(tenantId, userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List devices' })
  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ListDevicesQueryDto) {
    return this.deviceService.findAll(tenantId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get device by id' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.deviceService.findOne(tenantId, id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SUPPORT')
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
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'SUPPORT')
  @ApiOperation({ summary: 'Delete device' })
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.deviceService.remove(tenantId, userId, id);
  }

  @Get(':id/licences')
  @ApiOperation({ summary: 'List licences attached to device' })
  findLicencesForDevice(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.deviceService.findLicences(tenantId, id);
  }
}
