import { Controller, Get, Param, Post, Body, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TravelOrdersService } from './travel-orders.service';
import { CreateTravelOrderDto } from './dto/create-travel-order.dto';

@ApiTags('travel-orders')
@Controller('travel-orders')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class TravelOrdersController {
  constructor(private readonly orders: TravelOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List travel orders (own, or all if permitted)' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @CurrentUser('roleId') roleId: string | undefined,
  ) {
    return this.orders.list(tenantId, userId, role, roleId);
  }

  @Post()
  @ApiOperation({ summary: 'Create travel order, documents, and send mail' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @CurrentUser('roleId') roleId: string | undefined,
    @Body() dto: CreateTravelOrderDto,
  ) {
    return this.orders.create(tenantId, userId, role, roleId, dto);
  }

  @Get(':id/nalog')
  @ApiOperation({ summary: 'Download travel order document' })
  async nalog(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @CurrentUser('roleId') roleId: string | undefined,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.orders.file(tenantId, userId, role, roleId, id, 'nalog');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Get(':id/odluka')
  @ApiOperation({ summary: 'Download travel decision document' })
  async odluka(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @CurrentUser('roleId') roleId: string | undefined,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.orders.file(tenantId, userId, role, roleId, id, 'odluka');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }
}
