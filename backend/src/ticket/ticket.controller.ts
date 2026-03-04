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
  @ApiOperation({ summary: 'Quick Call – create CALL ticket from phone; find or create contact' })
  @ApiResponse({ status: 201, description: 'Returns ticket, contact, and company (or null).' })
  quickCall(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string | undefined,
    @Body() dto: QuickCallDto,
  ) {
    return this.ticketService.quickCall(tenantId, dto, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create ticket' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateTicketDto,
  ) {
    return this.ticketService.create(tenantId, dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List tickets with filters and pagination' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: TicketListQueryDto,
  ) {
    return this.ticketService.findAll(tenantId, query);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'List comments (sort createdAt asc)' })
  getComments(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.ticketCommentService.findAll(tenantId, id);
  }

  @Post(':id/comments')
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
  @ApiOperation({ summary: 'List tasks (sort orderNo asc)' })
  getTasks(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.ticketTaskService.findAll(tenantId, id);
  }

  @Post(':id/tasks')
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
  @ApiOperation({ summary: 'Delete task' })
  deleteTask(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('taskId') taskId: string,
  ) {
    return this.ticketTaskService.remove(tenantId, id, taskId);
  }

  @Post(':id/tags')
  @ApiOperation({ summary: 'Assign tags to ticket (duplicates ignored)' })
  assignTags(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: TicketTagIdsDto,
  ) {
    return this.tagService.assignToTicket(tenantId, id, dto);
  }

  @Delete(':id/tags')
  @ApiOperation({ summary: 'Unassign tags from ticket' })
  unassignTags(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: TicketTagIdsDto,
  ) {
    return this.tagService.unassignFromTicket(tenantId, id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket by id (with commentsCount, openTasksCount, tags)' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.ticketService.findOne(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ticket' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.ticketService.update(tenantId, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update ticket status' })
  updateStatus(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: PatchStatusDto,
  ) {
    return this.ticketService.updateStatus(tenantId, id, dto.status);
  }

  @Patch(':id/assign-to-me')
  @ApiOperation({ summary: 'Assign ticket to current user' })
  assignToMe(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.ticketService.update(tenantId, id, { assigneeId: userId });
  }

  @Patch(':id/call-time/now')
  @ApiOperation({ summary: 'Set call occurred time to now (button NOW)' })
  @ApiResponse({ status: 200, description: 'Ticket with callOccurredAt set to current time.' })
  setCallTimeNow(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.ticketService.setCallTimeNow(tenantId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete ticket' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.ticketService.remove(tenantId, id);
  }
}
