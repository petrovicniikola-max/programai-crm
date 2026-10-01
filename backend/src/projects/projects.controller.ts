import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('projects', 'view')
  @ApiOperation({ summary: 'List projects (SUPER_ADMIN: all; others: assigned only)' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.projects.list(tenantId, { userId, role });
  }

  @Get('work-order-articles')
  @UseGuards(PermissionsGuard)
  @RequirePermission('projects', 'view')
  @ApiOperation({ summary: 'List fixed work-order article catalog' })
  listArticles() {
    return this.projects.listArticles();
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('projects', 'edit')
  @ApiOperation({ summary: 'Create project (admin)' })
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateProjectDto) {
    return this.projects.create(tenantId, dto);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('projects', 'view')
  @ApiOperation({ summary: 'Get project by id (admin or assigned)' })
  get(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
  ) {
    return this.projects.get(tenantId, id, { userId, role });
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('projects', 'edit')
  @ApiOperation({ summary: 'Update project (admin)' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('projects', 'edit')
  @ApiOperation({ summary: 'Delete project (admin)' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.projects.remove(tenantId, id);
  }

  @Get(':id/work-orders/export')
  @UseGuards(PermissionsGuard)
  @RequirePermission('projects', 'view')
  @ApiOperation({ summary: 'Export project work orders to Excel (one row per article line)' })
  async exportWorkOrders(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const fmt = (format ?? 'xlsx').toLowerCase();
    if (fmt !== 'xlsx') {
      res.status(400);
      return { message: 'Only format=xlsx is supported' };
    }
    const buffer = await this.projects.exportWorkOrdersXlsx(tenantId, id, { userId, role });
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="radni-nalozi-${id}.xlsx"`,
    });
    return new StreamableFile(buffer);
  }

  @Get(':id/work-orders')
  @UseGuards(PermissionsGuard)
  @RequirePermission('projects', 'view')
  @ApiOperation({ summary: 'List work orders for project (admin or assigned)' })
  listWorkOrders(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
  ) {
    return this.projects.listWorkOrders(tenantId, id, { userId, role });
  }

  @Post(':id/work-orders')
  @UseGuards(PermissionsGuard)
  @RequirePermission('projects', 'edit')
  @ApiOperation({ summary: 'Create work order on project (assigned users)' })
  createWorkOrder(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
    @Body() dto: CreateWorkOrderDto,
  ) {
    return this.projects.createWorkOrder(tenantId, id, { userId, role }, dto);
  }

  @Get(':id/stats')
  @UseGuards(PermissionsGuard)
  @RequirePermission('projects', 'view')
  @ApiOperation({ summary: 'Project stats: total hours + hours by user (admin or assigned)' })
  stats(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
  ) {
    return this.projects.stats(tenantId, id, { userId, role });
  }
}

@ApiTags('projects')
@Controller()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@ApiBearerAuth()
export class ProjectWorkOrdersController {
  constructor(private readonly projects: ProjectsService) {}

  @Patch('work-orders/:id')
  @RequirePermission('projects', 'edit')
  @ApiOperation({ summary: 'Update work order (admin)' })
  updateWorkOrder(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkOrderDto,
  ) {
    return this.projects.updateWorkOrder(tenantId, id, dto);
  }

  @Delete('work-orders/:id')
  @RequirePermission('projects', 'edit')
  @ApiOperation({ summary: 'Delete work order (admin)' })
  removeWorkOrder(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.projects.removeWorkOrder(tenantId, id);
  }
}
