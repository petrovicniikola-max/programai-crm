import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TicketService } from './ticket.service';
import { TicketCommentService } from './ticket-comment.service';
import { TicketTaskService } from './ticket-task.service';
import { TagService } from '../tag/tag.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { PatchStatusDto } from './dto/patch-status.dto';
import { TicketListQueryDto } from './dto/ticket-list-query.dto';
import { QuickCallDto } from './dto/quick-call.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TicketTagIdsDto } from './dto/ticket-tags.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('tickets')
@Controller('tickets')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class TicketController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly ticketCommentService: TicketCommentService,
    private readonly ticketTaskService: TicketTaskService,
    private readonly tagService: TagService,
  ) {}

  @Post('quick-call')
  @UseGuards(PermissionsGuard)
  @RequirePermission('calls', 'edit')
  @ApiOperation({ summary: 'Quick Call / Outgoing Call – create CALL ticket; optional conversationKind (Quick) or contactMethod+contactsContactedCount (Outgoing)' })
  @ApiResponse({ status: 201, description: 'Returns ticket, contact, and company (or null).' })
  quickCall(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string | undefined,
    @Body() dto: QuickCallDto,
  ) {
    return this.ticketService.quickCall(tenantId, dto, userId);
  }

  @Get('quick-call/client-lookup')
  @UseGuards(PermissionsGuard)
  @RequirePermission('calls', 'view')
  @ApiOperation({ summary: 'Lookup client (contact + company) by phone, contact name, company name, companyId, pib or mb for Quick Call autofill' })
  clientLookup(
    @CurrentUser('tenantId') tenantId: string,
    @Query('phone') phone: string | undefined,
    @Query('contactName') contactName: string | undefined,
    @Query('companyName') companyName: string | undefined,
    @Query('companyId') companyId: string | undefined,
    @Query('pib') pib: string | undefined,
    @Query('mb') mb: string | undefined,
  ) {
    return this.ticketService.lookupClientForQuickCall(tenantId, {
      phone: phone?.trim(),
      contactName: contactName?.trim(),
      companyName: companyName?.trim(),
      companyId: companyId?.trim(),
      pib: pib?.trim(),
      mb: mb?.trim(),
    });
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('tickets', 'edit')
  @ApiOperation({ summary: 'Create ticket' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateTicketDto,
  ) {
    return this.ticketService.create(tenantId, dto, userId);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('tickets', 'view')
  @ApiOperation({ summary: 'List tickets with filters and pagination' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: TicketListQueryDto,
  ) {
    return this.ticketService.findAll(tenantId, query);
  }

  @Get(':id/comments')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tickets', 'view')
  @ApiOperation({ summary: 'List comments (sort createdAt asc)' })
  getComments(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.ticketCommentService.findAll(tenantId, id);
  }

  @Post(':id/comments')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tickets', 'edit')
  @ApiOperation({ summary: 'Add comment (authorId from JWT)' })
  @ApiResponse({ status: 201, description: 'Created comment' })
  addComment(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.ticketCommentService.create(tenantId, id, userId, dto);
  }

  @Get(':id/tasks')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tickets', 'view')
  @ApiOperation({ summary: 'List tasks (sort orderNo asc)' })
  getTasks(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.ticketTaskService.findAll(tenantId, id);
  }

  @Post(':id/tasks')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tickets', 'edit')
  @ApiOperation({ summary: 'Add task' })
  @ApiResponse({ status: 201, description: 'Created task' })
  addTask(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.ticketTaskService.create(tenantId, id, dto);
  }

  @Patch(':id/tasks/:taskId')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tickets', 'edit')
  @ApiOperation({ summary: 'Update task (title, isDone, orderNo)' })
  updateTask(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.ticketTaskService.update(tenantId, id, taskId, dto);
  }

  @Delete(':id/tasks/:taskId')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tickets', 'edit')
  @ApiOperation({ summary: 'Delete task' })
  deleteTask(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('taskId') taskId: string,
  ) {
    return this.ticketTaskService.remove(tenantId, id, taskId);
  }

  @Post(':id/tags')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tickets', 'edit')
  @ApiOperation({ summary: 'Assign tags to ticket (duplicates ignored)' })
  assignTags(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: TicketTagIdsDto,
  ) {
    return this.tagService.assignToTicket(tenantId, id, dto);
  }

  @Delete(':id/tags')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tickets', 'edit')
  @ApiOperation({ summary: 'Unassign tags from ticket' })
  unassignTags(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: TicketTagIdsDto,
  ) {
    return this.tagService.unassignFromTicket(tenantId, id, dto);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tickets', 'view')
  @ApiOperation({ summary: 'Get ticket by id (with commentsCount, openTasksCount, tags)' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.ticketService.findOne(tenantId, id);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tickets', 'edit')
  @ApiOperation({ summary: 'Update ticket' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.ticketService.update(tenantId, id, dto);
  }

  @Patch(':id/status')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tickets', 'edit')
  @ApiOperation({ summary: 'Update ticket status' })
  updateStatus(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: PatchStatusDto,
  ) {
    return this.ticketService.updateStatus(tenantId, id, dto.status);
  }

  @Patch(':id/assign-to-me')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tickets', 'edit')
  @ApiOperation({ summary: 'Assign ticket to current user' })
  assignToMe(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.ticketService.update(tenantId, id, { assigneeId: userId });
  }

  @Patch(':id/call-time/now')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tickets', 'edit')
  @ApiOperation({ summary: 'Set call occurred time to now (button NOW)' })
  @ApiResponse({ status: 200, description: 'Ticket with callOccurredAt set to current time.' })
  setCallTimeNow(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.ticketService.setCallTimeNow(tenantId, id);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tickets', 'edit')
  @ApiOperation({ summary: 'Delete ticket' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.ticketService.remove(tenantId, id);
  }
}
