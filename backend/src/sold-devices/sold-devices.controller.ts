import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SoldDevicesService } from './sold-devices.service';
import { CreateSoldDeviceDto } from './dto/create-sold-device.dto';

@ApiTags('sold-devices')
@Controller('sold-devices')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class SoldDevicesController {
  constructor(private readonly devices: SoldDevicesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista prodatih uređaja' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @CurrentUser('roleId') roleId: string | undefined,
  ) {
    return this.devices.list(tenantId, userId, role, roleId);
  }

  @Post()
  @ApiOperation({ summary: 'Unos prodatog uređaja' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @CurrentUser('roleId') roleId: string | undefined,
    @Body() dto: CreateSoldDeviceDto,
  ) {
    return this.devices.create(tenantId, userId, role, roleId, dto);
  }
}
