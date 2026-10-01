import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DistributorService } from './distributor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('distributors')
@Controller('distributors')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class DistributorController {
  constructor(private readonly distributorService: DistributorService) {}

  @Get()
  @ApiOperation({ summary: 'List distributors with device counts' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'kind', required: false, enum: ['all', 'main', 'sub'] })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('search') search?: string,
    @Query('kind') kind: 'all' | 'main' | 'sub' = 'all',
  ) {
    if (kind === 'main') return this.distributorService.findMainDistributors(tenantId, search);
    if (kind === 'sub') return this.distributorService.findSubDistributors(tenantId, search);
    return this.distributorService.findAll(tenantId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get distributor by id' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.distributorService.findOne(tenantId, id);
  }
}
