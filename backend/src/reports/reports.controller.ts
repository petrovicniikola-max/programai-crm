import { Controller, Get, Post, Patch, Body, Query, UseGuards, Res, Header, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { TicketService } from '../ticket/ticket.service';
import { TicketListQueryDto } from '../ticket/dto/ticket-list-query.dto';
import { TicketsExportQueryDto } from './dto/tickets-export-query.dto';
import { PatchAlertsConfigDto } from './dto/alerts-config.dto';
import { ExecuteReportDto } from './dto/execute-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
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
  @ApiOperation({ summary: 'Reports overview – aggregated counts for dashboard' })
  getOverview(@CurrentUser('tenantId') tenantId: string) {
    return this.reportsService.getOverview(tenantId);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'List tickets for reports (same as GET /tickets)' })
  getTickets(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: TicketListQueryDto,
  ) {
    return this.ticketService.findAll(tenantId, query);
  }

  @Get('tickets/export')
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

  @Get('tables/export')
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
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get alerts & scheduled report config (SUPER_ADMIN)' })
  getAlertsConfig(@CurrentUser('tenantId') tenantId: string) {
    return this.reportsService.getAlertsConfig(tenantId);
  }

  @Patch('alerts/config')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update scheduled report config (SUPER_ADMIN)' })
  patchAlertsConfig(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: PatchAlertsConfigDto,
  ) {
    return this.reportsService.patchAlertsConfig(tenantId, dto);
  }

  @Post('alerts/execute')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Execute report now and send to saved emails (SUPER_ADMIN)' })
  executeReport(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: ExecuteReportDto,
  ) {
    return this.reportsService.executeReport(tenantId, dto.reportType, dto.daysBack);
  }
}
