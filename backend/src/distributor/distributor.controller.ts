import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.distributorService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get distributor by id' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.distributorService.findOne(tenantId, id);
  }
}
