import { Controller, Get, Post, Patch, Body, Query, UseGuards, Res, Header, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { TicketService } from '../ticket/ticket.service';
import { TicketListQueryDto } from '../ticket/dto/ticket-list-query.dto';
import { TicketsExportQueryDto } from './dto/tickets-export-query.dto';
import { SalesExportQueryDto } from './dto/sales-export-query.dto';
import { PatchAlertsConfigDto } from './dto/alerts-config.dto';
import { ExecuteReportDto } from './dto/execute-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly ticketService: TicketService,
  ) {}

  @Get('overview')
  @UseGuards(PermissionsGuard)
  @RequirePermission('reports.overview', 'view')
  @ApiOperation({ summary: 'Reports overview – aggregated counts for dashboard' })
  getOverview(@CurrentUser('tenantId') tenantId: string) {
    return this.reportsService.getOverview(tenantId);
  }

  @Get('admin-dashboard')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Admin kontrolna tabla – agregirani pregled (SUPER_ADMIN)' })
  getAdminDashboard(@CurrentUser('tenantId') tenantId: string) {
    return this.reportsService.getAdminDashboard(tenantId);
  }

  @Get('tickets')
  @UseGuards(PermissionsGuard)
  @RequirePermission('reports.tickets', 'view')
  @ApiOperation({ summary: 'List tickets for reports (same as GET /tickets)' })
  getTickets(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: TicketListQueryDto,
  ) {
    return this.ticketService.findAll(tenantId, query);
  }

  @Get('tickets/export')
  @UseGuards(PermissionsGuard)
  @RequirePermission('reports.tickets', 'edit')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export tickets as CSV (respects filters)' })
  async exportTicketsCsv(
    @CurrentUser('tenantId') tenantId: string,
    @Res() res: Response,
    @Query() query: TicketsExportQueryDto,
  ) {
    const csv = await this.reportsService.getTicketsCsv(tenantId, query);
    const filename = `tickets_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('sales/export')
  @UseGuards(PermissionsGuard)
  @RequirePermission('sales', 'view')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export Prodaja (Outgoing Call) tickets as CSV' })
  async exportSalesCsv(
    @CurrentUser('tenantId') tenantId: string,
    @Res() res: Response,
    @Query() query: SalesExportQueryDto,
  ) {
    const csv = await this.reportsService.getSalesCsv(tenantId, query);
    const filename = `prodaja_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('tables/export')
  @UseGuards(PermissionsGuard)
  @RequirePermission('reports.tables', 'edit')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export form/table responses as CSV' })
  @ApiQuery({ name: 'formId', required: true, description: 'Form ID' })
  async exportTableCsv(
    @CurrentUser('tenantId') tenantId: string,
    @Res() res: Response,
    @Query('formId') formId: string,
  ) {
    if (!formId?.trim()) {
      throw new BadRequestException('formId is required');
    }
    const csv = await this.reportsService.getTableCsv(tenantId, formId.trim());
    const filename = `table_${formId}_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('alerts/config')
  @UseGuards(PermissionsGuard)
  @RequirePermission('reports.alerts', 'view')
  @ApiOperation({ summary: 'Get alerts & scheduled report config' })
  getAlertsConfig(@CurrentUser('tenantId') tenantId: string) {
    return this.reportsService.getAlertsConfig(tenantId);
  }

  @Patch('alerts/config')
  @UseGuards(PermissionsGuard)
  @RequirePermission('reports.alerts', 'edit')
  @ApiOperation({ summary: 'Update scheduled report config' })
  patchAlertsConfig(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: PatchAlertsConfigDto,
  ) {
    return this.reportsService.patchAlertsConfig(tenantId, dto);
  }

  @Post('alerts/execute')
  @UseGuards(PermissionsGuard)
  @RequirePermission('reports.alerts', 'edit')
  @ApiOperation({ summary: 'Execute report: executeAll=true runs per-email configs; otherwise single report to saved emails' })
  executeReport(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: ExecuteReportDto,
  ) {
    return this.reportsService.executeReport(tenantId, {
      executeAll: dto.executeAll,
      configIndex: dto.configIndex,
      reportType: dto.reportType,
      daysBack: dto.daysBack,
      deviceIds: dto.deviceIds,
    });
  }
}
