import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TagService } from './tag.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('tags')
@Controller('tags')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Post()
  @ApiOperation({ summary: 'Create tag (tenant-level, unique by name)' })
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateTagDto) {
    return this.tagService.create(tenantId, dto.name);
  }

  @Get()
  @ApiOperation({ summary: 'List tags in tenant (sort name asc)' })
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.tagService.findAll(tenantId);
  }
}
