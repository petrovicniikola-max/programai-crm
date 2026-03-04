import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('contacts')
@Controller('contacts')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @ApiOperation({ summary: 'Create contact' })
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateContactDto) {
    return this.contactService.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List contacts or search by phone' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('phone') phone?: string,
  ) {
    if (phone != null && String(phone).trim() !== '') {
      return this.contactService.searchByPhone(tenantId, String(phone));
    }
    return this.contactService.findAll(tenantId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search contacts by phone (normalised)' })
  search(@CurrentUser('tenantId') tenantId: string, @Query('phone') phone: string) {
    return this.contactService.searchByPhone(tenantId, phone ?? '');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contact by id' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.contactService.findOne(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update contact' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete contact' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.contactService.remove(tenantId, id);
  }
}
