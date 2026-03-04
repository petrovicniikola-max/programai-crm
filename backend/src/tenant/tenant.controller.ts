import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('tenant')
@Controller('tenant')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get current tenant settings' })
  async getSettings(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantService.getSettings(tenantId);
  }

  @Patch('settings')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update tenant settings (SUPER_ADMIN only)' })
  async updateSettings(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateTenantSettingsDto,
  ) {
    return this.tenantService.updateSettings(tenantId, dto.data ?? {});
  }
}
