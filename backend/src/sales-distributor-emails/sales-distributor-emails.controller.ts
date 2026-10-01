import {
  BadRequestException,
  Controller,
  Get,
  Header,
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
import { SalesDistributorEmailsService } from './sales-distributor-emails.service';

@ApiTags('sales-distributor-emails')
@Controller('sales/distributor-emails')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class SalesDistributorEmailsController {
  constructor(
    private readonly salesDistributorEmailsService: SalesDistributorEmailsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List distributor email rows (sales)' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('filterField') filterField?: string,
    @Query('filterValue') filterValue?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.salesDistributorEmailsService.list(
      tenantId,
      Number(page) || 1,
      Number(limit) || 50,
      filterField,
      filterValue,
      sortBy,
      sortOrder,
    );
  }

  @Post('import')
  @ApiOperation({ summary: 'Import distributor email rows from CSV/XLSX' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importFile(
    @CurrentUser('tenantId') tenantId: string,
    @UploadedFile() file?: Express.Multer.File,
    @CurrentUser('userId') userId?: string,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.salesDistributorEmailsService.importFile(tenantId, file, userId);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export distributor email rows as CSV or XLSX' })
  @Header('Content-Type', 'application/octet-stream')
  async exportRows(
    @CurrentUser('tenantId') tenantId: string,
    @Res() res: Response,
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const safeFormat = format === 'xlsx' ? 'xlsx' : 'csv';
    const data = await this.salesDistributorEmailsService.exportRows(
      tenantId,
      safeFormat,
      sortBy,
      sortOrder,
    );
    const date = new Date().toISOString().slice(0, 10);
    const filename = `prodaja_mailovi_distributeri_${date}.${safeFormat}`;
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

