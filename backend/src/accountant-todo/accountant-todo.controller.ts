import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccountantTodoService } from './accountant-todo.service';
import { TodoTeamService } from './todo-team.service';
import { CreateAccountantTodoDto } from './dto/create-accountant-todo.dto';
import { UpdateAccountantTodoDto } from './dto/update-accountant-todo.dto';
import { UpdateAccountantTodoSettingsDto } from './dto/update-accountant-todo-settings.dto';
import { CreateTodoTeamDto } from './dto/create-todo-team.dto';
import { UpdateTodoTeamDto } from './dto/update-todo-team.dto';
import { SetTodoTeamMembersDto } from './dto/set-todo-team-members.dto';

@ApiTags('accountant-todos')
@Controller()
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class AccountantTodoController {
  constructor(
    private readonly todos: AccountantTodoService,
    private readonly teams: TodoTeamService,
  ) {}

  @Get('accountant-todos/my-teams')
  @UseGuards(PermissionsGuard)
  @RequirePermission('todo', 'view')
  @ApiOperation({ summary: 'Teams current user belongs to' })
  myTeams(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.teams.listForUser(tenantId, userId);
  }

  @Get('accountant-todos')
  @UseGuards(PermissionsGuard)
  @RequirePermission('todo', 'view')
  @ApiOperation({ summary: 'List accountant todos by tab' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Query('tab') tab: 'mine' | 'team' | 'completed' = 'mine',
    @Query('teamId') teamId?: string,
  ) {
    return this.todos.list(tenantId, userId, tab, teamId);
  }

  @Get('accountant-todos/dashboard')
  @UseGuards(PermissionsGuard)
  @RequirePermission('todo', 'view')
  @ApiOperation({ summary: 'Dashboard preview of todos' })
  dashboard(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.todos.listDashboard(tenantId, userId);
  }

  @Post('accountant-todos')
  @UseGuards(PermissionsGuard)
  @RequirePermission('todo', 'edit')
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateAccountantTodoDto,
  ) {
    return this.todos.create(tenantId, userId, dto);
  }

  @Patch('accountant-todos/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('todo', 'edit')
  update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAccountantTodoDto,
  ) {
    return this.todos.update(tenantId, userId, id, dto);
  }

  @Delete('accountant-todos/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('todo', 'edit')
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.todos.remove(tenantId, userId, id);
  }

  @Get('settings/accountant-todos')
  @UseGuards(PermissionsGuard)
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Get global accountant todo defaults (fallback reminder time)' })
  getSettings(@CurrentUser('tenantId') tenantId: string) {
    return this.todos.getSettings(tenantId);
  }

  @Patch('settings/accountant-todos')
  @UseGuards(PermissionsGuard)
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Update global accountant todo defaults' })
  updateSettings(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateAccountantTodoSettingsDto,
  ) {
    return this.todos.updateSettings(tenantId, dto);
  }

  @Get('settings/todo-teams')
  @UseGuards(PermissionsGuard)
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'List TO DO teams' })
  listTeams(@CurrentUser('tenantId') tenantId: string) {
    return this.teams.list(tenantId);
  }

  @Post('settings/todo-teams')
  @UseGuards(PermissionsGuard)
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Create TO DO team' })
  createTeam(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateTodoTeamDto,
  ) {
    return this.teams.create(tenantId, dto);
  }

  @Get('settings/todo-teams/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Get TO DO team' })
  getTeam(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.teams.getOne(tenantId, id);
  }

  @Patch('settings/todo-teams/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Update TO DO team' })
  updateTeam(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTodoTeamDto,
  ) {
    return this.teams.update(tenantId, id, dto);
  }

  @Delete('settings/todo-teams/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Delete TO DO team' })
  deleteTeam(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.teams.remove(tenantId, id);
  }

  @Put('settings/todo-teams/:id/members')
  @UseGuards(PermissionsGuard)
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Set team members (replaces list)' })
  setTeamMembers(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: SetTodoTeamMembersDto,
  ) {
    return this.teams.setMembers(tenantId, id, dto.userIds);
  }
}
