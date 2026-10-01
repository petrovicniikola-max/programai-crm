import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountantTodoStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountantTodoDto } from './dto/create-accountant-todo.dto';
import { UpdateAccountantTodoDto } from './dto/update-accountant-todo.dto';
import { UpdateAccountantTodoSettingsDto } from './dto/update-accountant-todo-settings.dto';
import { TodoTeamService } from './todo-team.service';
import {
  belgradeStartOfToday,
  isSameBelgradeDay,
} from './accountant-todo-date.utils';

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
} as const;

export type AccountantTodoTab = 'mine' | 'team' | 'completed' | 'dashboard';

@Injectable()
export class AccountantTodoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TodoTeamService,
  ) {}

  private mapTodo(
    todo: {
      id: string;
      title: string;
      dueDate: Date | null;
      reminderEnabled: boolean;
      status: AccountantTodoStatus;
      completedAt: Date | null;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
      userId: string;
      user: { id: string; email: string; displayName: string | null; role: string };
    },
    sharedTeams?: string[],
  ) {
    const completedToday =
      todo.status === AccountantTodoStatus.COMPLETED &&
      todo.completedAt != null &&
      isSameBelgradeDay(todo.completedAt, new Date());
    return {
      id: todo.id,
      title: todo.title,
      dueDate: todo.dueDate,
      reminderEnabled: todo.reminderEnabled,
      status: todo.status,
      completedAt: todo.completedAt,
      completedToday,
      sortOrder: todo.sortOrder,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
      userId: todo.userId,
      user: todo.user,
      sharedTeams: sharedTeams ?? [],
      isOverdue:
        todo.status === AccountantTodoStatus.ACTIVE &&
        todo.dueDate != null &&
        belgradeStartOfToday(todo.dueDate).getTime() < belgradeStartOfToday().getTime(),
      isDueToday:
        todo.status === AccountantTodoStatus.ACTIVE &&
        todo.dueDate != null &&
        isSameBelgradeDay(todo.dueDate, new Date()),
    };
  }

  async list(
    tenantId: string,
    userId: string,
    tab: AccountantTodoTab,
    teamId?: string,
  ) {
    const baseInclude = { user: { select: userSelect } };

    if (tab === 'mine') {
      const todos = await this.prisma.accountantTodo.findMany({
        where: {
          tenantId,
          userId,
          OR: [
            { status: AccountantTodoStatus.ACTIVE },
            {
              status: AccountantTodoStatus.COMPLETED,
              completedAt: { gte: belgradeStartOfToday() },
            },
          ],
        },
        include: baseInclude,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        take: 500,
      });
      return todos.map((t) => this.mapTodo(t));
    }

    if (tab === 'team') {
      const teammateIds = await this.teams.getTeammateUserIds(tenantId, userId, teamId);
      if (!teammateIds.length) return [];

      const todos = await this.prisma.accountantTodo.findMany({
        where: {
          tenantId,
          userId: { in: teammateIds },
          status: AccountantTodoStatus.ACTIVE,
        },
        include: baseInclude,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 500,
      });

      const teamMap = await this.teams.getSharedTeamNamesByUserId(
        tenantId,
        userId,
        todos.map((t) => t.userId),
      );

      return todos.map((t) => this.mapTodo(t, teamMap.get(t.userId) ?? []));
    }

    const todos = await this.prisma.accountantTodo.findMany({
      where: {
        tenantId,
        userId,
        status: AccountantTodoStatus.COMPLETED,
        completedAt: { lt: belgradeStartOfToday() },
      },
      include: baseInclude,
      orderBy: { completedAt: 'desc' },
      take: 500,
    });
    return todos.map((t) => this.mapTodo(t));
  }

  async listDashboard(tenantId: string, userId: string) {
    const mine = await this.list(tenantId, userId, 'mine');
    const team = await this.list(tenantId, userId, 'team');
    return {
      mine: mine.slice(0, 10),
      team: team.slice(0, 10),
    };
  }

  async create(tenantId: string, userId: string, dto: CreateAccountantTodoDto) {
    const maxOrder = await this.prisma.accountantTodo.aggregate({
      where: { tenantId, userId },
      _max: { sortOrder: true },
    });
    const todo = await this.prisma.accountantTodo.create({
      data: {
        tenantId,
        userId,
        title: dto.title.trim(),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        reminderEnabled: dto.reminderEnabled ?? true,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
      include: { user: { select: userSelect } },
    });
    return this.mapTodo(todo);
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateAccountantTodoDto,
  ) {
    const existing = await this.prisma.accountantTodo.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Task nije pronađen.');
    if (existing.userId !== userId) {
      throw new ForbiddenException('Možete menjati samo svoje taskove.');
    }

    const data: {
      title?: string;
      dueDate?: Date | null;
      reminderEnabled?: boolean;
      status?: AccountantTodoStatus;
      completedAt?: Date | null;
    } = {};

    if (dto.title != null) data.title = dto.title.trim();
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.reminderEnabled != null) data.reminderEnabled = dto.reminderEnabled;
    if (dto.status != null) {
      data.status = dto.status;
      if (dto.status === AccountantTodoStatus.COMPLETED) {
        data.completedAt = new Date();
      } else if (dto.status === AccountantTodoStatus.ACTIVE) {
        data.completedAt = null;
      }
    }

    const todo = await this.prisma.accountantTodo.update({
      where: { id },
      data,
      include: { user: { select: userSelect } },
    });
    return this.mapTodo(todo);
  }

  async remove(tenantId: string, userId: string, id: string) {
    const existing = await this.prisma.accountantTodo.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Task nije pronađen.');
    if (existing.userId !== userId) {
      throw new ForbiddenException('Možete brisati samo svoje taskove.');
    }
    await this.prisma.accountantTodo.delete({ where: { id } });
    return { ok: true };
  }

  async getSettings(tenantId: string) {
    const row = await this.prisma.tenantAccountantTodoSettings.findUnique({
      where: { tenantId },
    });
    return {
      extraRecipients: Array.isArray(row?.extraRecipients)
        ? (row!.extraRecipients as string[])
        : [],
      reminderTime: row?.reminderTime ?? '08:00',
    };
  }

  async updateSettings(tenantId: string, dto: UpdateAccountantTodoSettingsDto) {
    const extraRecipients = dto.extraRecipients ?? [];
    const reminderTime = dto.reminderTime ?? '08:00';
    const row = await this.prisma.tenantAccountantTodoSettings.upsert({
      where: { tenantId },
      create: { tenantId, extraRecipients, reminderTime },
      update: {
        ...(dto.extraRecipients != null ? { extraRecipients } : {}),
        ...(dto.reminderTime != null ? { reminderTime } : {}),
      },
    });
    return {
      extraRecipients: Array.isArray(row.extraRecipients)
        ? (row.extraRecipients as string[])
        : [],
      reminderTime: row.reminderTime,
    };
  }

  async getActiveTodosForUsers(tenantId: string, userIds: string[]) {
    if (!userIds.length) return [];
    return this.prisma.accountantTodo.findMany({
      where: {
        tenantId,
        userId: { in: userIds },
        status: AccountantTodoStatus.ACTIVE,
        reminderEnabled: true,
      },
      include: { user: { select: userSelect } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
