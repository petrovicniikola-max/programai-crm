import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsService } from './permissions.service';
import { RolesService } from './roles.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  UpdateRolePermissionsDto,
} from './dto/create-role.dto';

@ApiTags('permissions')
@Controller()
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class PermissionsController {
  constructor(
    private readonly permissions: PermissionsService,
    private readonly roles: RolesService,
  ) {}

  @Get('permissions/catalog')
  @ApiOperation({ summary: 'Permission resource catalog' })
  getCatalog() {
    return this.permissions.getCatalog();
  }

  @Get('settings/roles')
  @UseGuards(RolesGuard, PermissionsGuard)
  @RequirePermission('settings.roles', 'view')
  @ApiOperation({ summary: 'List roles' })
  listRoles() {
    return this.roles.listRoles();
  }

  @Post('settings/roles')
  @UseGuards(RolesGuard, PermissionsGuard)
  @RequirePermission('settings.roles', 'edit')
  @ApiOperation({ summary: 'Create custom role' })
  createRole(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.roles.createRole(tenantId, actorUserId, dto);
  }

  @Patch('settings/roles/:id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @RequirePermission('settings.roles', 'edit')
  @ApiOperation({ summary: 'Update role metadata' })
  updateRole(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roles.updateRole(tenantId, actorUserId, id, dto);
  }

  @Delete('settings/roles/:id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @RequirePermission('settings.roles', 'edit')
  @ApiOperation({ summary: 'Delete custom role' })
  deleteRole(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
  ) {
    return this.roles.deleteRole(tenantId, actorUserId, id);
  }

  @Get('settings/roles/:id/permissions')
  @UseGuards(RolesGuard, PermissionsGuard)
  @RequirePermission('settings.roles', 'edit')
  @ApiOperation({ summary: 'Get permission matrix for role' })
  getRolePermissions(@Param('id') id: string) {
    return this.roles.getRolePermissions(id);
  }

  @Patch('settings/roles/:id/permissions')
  @UseGuards(RolesGuard, PermissionsGuard)
  @RequirePermission('settings.roles', 'edit')
  @ApiOperation({ summary: 'Update permission matrix for role' })
  updateRolePermissions(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.roles.updateRolePermissions(tenantId, actorUserId, id, dto);
  }
}
