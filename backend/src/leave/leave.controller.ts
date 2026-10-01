import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { LeaveDecisionDto } from './dto/decision.dto';
import { LeaveTimelineQueryDto } from './dto/timeline-query.dto';
import { LeaveRequestStatus } from '@prisma/client';

@ApiTags('leave')
@Controller('leave')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Post('requests/preview')
  @ApiOperation({ summary: 'Preview leave request breakdown and balance' })
  preview(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.leave.preview(tenantId, userId, dto);
  }

  @Post('requests')
  @ApiOperation({ summary: 'Create draft leave request' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.leave.create(tenantId, userId, dto);
  }

  @Get('requests')
  @ApiOperation({ summary: 'List leave requests' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Query('status') status?: LeaveRequestStatus,
    @Query('scope') scope?: 'my' | 'pending-approvals',
  ) {
    return this.leave.listRequests(tenantId, { userId, role }, { status, scope });
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get leave request by id' })
  get(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
  ) {
    return this.leave.getRequest(tenantId, { userId, role }, id);
  }

  @Post('requests/:id/submit')
  @ApiOperation({ summary: 'Submit draft for approval' })
  submit(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.leave.submit(tenantId, userId, id);
  }

  @Patch('requests/:id/approve')
  @ApiOperation({ summary: 'Approve pending request' })
  approve(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
    @Body() dto: LeaveDecisionDto,
  ) {
    return this.leave.approve(tenantId, { userId, role }, id, dto);
  }

  @Patch('requests/:id/reject')
  @ApiOperation({ summary: 'Reject pending request' })
  reject(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
    @Body() dto: LeaveDecisionDto,
  ) {
    return this.leave.reject(tenantId, { userId, role }, id, dto);
  }

  @Patch('requests/:id/cancel')
  @ApiOperation({ summary: 'Cancel own leave request' })
  cancel(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.leave.cancel(tenantId, userId, id);
  }

  @Patch('requests/:id/needs-revision')
  @ApiOperation({ summary: 'Return request for revision' })
  needsRevision(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
    @Body() dto: LeaveDecisionDto,
  ) {
    return this.leave.needsRevision(tenantId, { userId, role }, id, dto);
  }

  @Get('timeline')
  @ApiOperation({ summary: 'Timeline view data' })
  timeline(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Query() query: LeaveTimelineQueryDto,
  ) {
    return this.leave.timeline(tenantId, { userId, role }, query);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Calendar view data' })
  calendar(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Query() query: LeaveTimelineQueryDto,
  ) {
    return this.leave.calendar(tenantId, { userId, role }, query);
  }

  @Get('balances/me')
  @ApiOperation({ summary: 'My leave balances' })
  balancesMe(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.leave.balancesMe(tenantId, userId);
  }

  @Get('reminders')
  @ApiOperation({ summary: 'Login reminder flags' })
  reminders(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.leave.reminders(tenantId, userId);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'In-app leave notifications (pending approvals + decisions)' })
  notifications(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.leave.notifications(tenantId, userId);
  }

  @Post('notifications/read')
  @ApiOperation({ summary: 'Mark leave decision notifications as read' })
  markNotificationsRead(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() body: { requestIds?: string[] },
  ) {
    return this.leave.markDecisionsRead(tenantId, userId, body?.requestIds);
  }

  @Get('absent-today')
  @ApiOperation({ summary: 'Who is on approved leave today' })
  absentToday(@CurrentUser('tenantId') tenantId: string) {
    return this.leave.absentToday(tenantId);
  }
}
