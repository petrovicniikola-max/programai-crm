import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('companies')
@Controller('companies')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @ApiOperation({ summary: 'Create company' })
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateCompanyDto) {
    return this.companyService.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List companies' })
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.companyService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get company by id' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.companyService.findOne(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update company' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companyService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete company' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.companyService.remove(tenantId, id);
  }

  @Get(':id/devices')
  @ApiOperation({ summary: 'List devices for company' })
  getDevicesForCompany(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.companyService.findDevices(tenantId, id);
  }

  @Get(':id/users')
  @ApiOperation({ summary: 'List users for company (e.g. USER role accounts)' })
  getUsersForCompany(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.companyService.findUsers(tenantId, id);
  }
}
