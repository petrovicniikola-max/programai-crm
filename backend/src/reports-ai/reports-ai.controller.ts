import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateAiReportDto } from './dto/create-ai-report.dto';
import { CreateAiReportScheduleDto } from './dto/create-ai-report-schedule.dto';
import { UpdateAiReportParamsDto } from './dto/update-ai-report-params.dto';
import { ReportsAiService } from './reports-ai.service';

@ApiTags('reports-ai')
@Controller('reports/ai')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class ReportsAiController {
  constructor(private readonly reportsAiService: ReportsAiService) {}

  private formatExportTimestamp(d = new Date()) {
    // YYYY-MM-DD_HH-mm-ss (UTC, safe for filenames)
    return d.toISOString().replace('T', '_').slice(0, 19).replaceAll(':', '-');
  }

  @Post('generate')
  @ApiOperation({ summary: 'Parse prompt and create AI report draft' })
  generate(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateAiReportDto) {
    return this.reportsAiService.generate(tenantId, dto.promptText);
  }

  @Get()
  @ApiOperation({ summary: 'List saved AI reports' })
  list(@CurrentUser('tenantId') tenantId: string) {
    return this.reportsAiService.list(tenantId);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Preview AI report result (table JSON)' })
  preview(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.reportsAiService.preview(tenantId, id);
  }

  @Patch(':id/period')
  @ApiOperation({ summary: 'Update year/month period for a saved template report' })
  updatePeriod(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAiReportParamsDto,
  ) {
    return this.reportsAiService.updatePeriodParams(tenantId, id, dto);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export AI report as CSV or XLSX' })
  @Header('Content-Type', 'application/octet-stream')
  async export(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Res() res: Response,
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
  ) {
    const safe = format === 'xlsx' ? 'xlsx' : 'csv';
    const data = await this.reportsAiService.export(tenantId, id, safe);
    const filename = `CRM-Estuar-${this.formatExportTimestamp()}.${safe}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader(
      'Content-Type',
      safe === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8',
    );
    res.send(data);
  }

  @Post(':id/schedules')
  @ApiOperation({ summary: 'Create schedule for AI report' })
  createSchedule(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateAiReportScheduleDto,
  ) {
    return this.reportsAiService.createSchedule(tenantId, id, dto);
  }

  @Get(':id/schedules')
  @ApiOperation({ summary: 'List schedules for AI report' })
  listSchedules(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.reportsAiService.listSchedules(tenantId, id);
  }

  @Post('schedules/:scheduleId/run-once')
  @ApiOperation({ summary: 'Run one schedule immediately (debug)' })
  runOnce(
    @CurrentUser('tenantId') tenantId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.reportsAiService.runScheduledOnce(tenantId, scheduleId);
  }
}

