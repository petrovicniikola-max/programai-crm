import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PlatformService } from './platform.service';
import { PlatformGuard } from './platform.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { ImpersonateDto } from './dto/impersonate.dto';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthService } from '../auth/auth.service';
import { AuditLogService } from '../settings/audit-log.service';

@ApiTags('platform')
@Controller('platform')
@UseGuards(JwtAuthGuard, PlatformGuard)
@ApiBearerAuth()
export class PlatformController {
  constructor(
    private readonly platformService: PlatformService,
    private readonly authService: AuthService,
    private readonly audit: AuditLogService,
  ) {}

  @Post('tenants')
  @ApiOperation({ summary: 'Create tenant (platform admin)' })
  createTenant(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateTenantDto,
  ) {
    return this.platformService.createTenant(userId, dto);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'List tenants' })
  listTenants(@Query() query: ListTenantsQueryDto) {
    return this.platformService.findAll(query);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Get tenant by id' })
  getTenant(@Param('id') id: string) {
    return this.platformService.findOne(id);
  }

  @Patch('tenants/:id')
  @ApiOperation({ summary: 'Update tenant' })
  updateTenant(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.platformService.updateTenant(userId, id, dto);
  }

  @Post('tenants/:id/users')
  @ApiOperation({ summary: 'Create first tenant admin (SUPER_ADMIN user)' })
  createTenantAdmin(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateTenantAdminDto,
  ) {
    return this.platformService.createTenantAdmin(userId, id, dto);
  }

  @Post('impersonate')
  @ApiOperation({ summary: 'Get short-lived token to act as tenant/user (troubleshooting)' })
  impersonate(
    @CurrentUser() user: { userId: string; email: string; displayName?: string },
    @Body() dto: ImpersonateDto,
  ) {
    return this.authService.impersonate(user.userId, dto.tenantId, dto.userId);
  }

  @Get('audit')
  @ApiOperation({ summary: 'View audit log for a tenant (or all if no tenantId)' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getAudit(@Query('tenantId') tenantId?: string, @Query('limit') limit?: string) {
    const n = limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50;
    return this.audit.findAll(tenantId ?? null, n);
  }
}
