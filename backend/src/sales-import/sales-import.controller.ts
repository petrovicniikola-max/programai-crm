import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Patch,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SalesImportService } from './sales-import.service';

@ApiTags('sales-import')
@Controller('sales/import-rows')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class SalesImportController {
  constructor(private readonly salesImportService: SalesImportService) {}

  @Get()
  @ApiOperation({ summary: 'List imported sales directory rows' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('filterField') filterField?: string,
    @Query('filterValue') filterValue?: string,
  ) {
    return this.salesImportService.list(
      tenantId,
      Number(page) || 1,
      Number(limit) || 50,
      filterField,
      filterValue,
    );
  }

  @Post('import')
  @ApiOperation({ summary: 'Import sales directory rows from CSV/XLSX' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importFile(
    @CurrentUser('tenantId') tenantId: string,
    @UploadedFile() file?: Express.Multer.File,
    @CurrentUser('userId') userId?: string,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.salesImportService.importFile(tenantId, file, userId);
  }

  @Post('manual')
  @ApiOperation({ summary: 'Create one sales directory row manually' })
  createManual(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.salesImportService.createManual(tenantId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit one sales directory row' })
  updateRow(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.salesImportService.updateRow(tenantId, id, dto);
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export imported sales directory rows as CSV or XLSX',
  })
  @Header('Content-Type', 'application/octet-stream')
  async exportRows(
    @CurrentUser('tenantId') tenantId: string,
    @Res() res: Response,
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
  ) {
    const safeFormat = format === 'xlsx' ? 'xlsx' : 'csv';
    const data = await this.salesImportService.exportRows(tenantId, safeFormat);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `prodaja_mails_pozivi_${date}.${safeFormat}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader(
      'Content-Type',
      safeFormat === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8',
    );
    res.send(data);
  }
}
