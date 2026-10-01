import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTodoTeamDto } from './dto/create-todo-team.dto';
import { UpdateTodoTeamDto } from './dto/update-todo-team.dto';

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  isActive: true,
} as const;

@Injectable()
export class TodoTeamService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeEmails(emails: string[] | undefined): string[] {
    if (!emails) return [];
    return [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  }

  async list(tenantId: string) {
    const teams = await this.prisma.todoTeam.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        members: {
          include: { user: { select: userSelect } },
        },
        _count: { select: { members: true } },
      },
    });
    return teams.map((t) => ({
      id: t.id,
      name: t.name,
      extraRecipients: Array.isArray(t.extraRecipients)
        ? (t.extraRecipients as string[])
        : [],
      reminderTime: t.reminderTime,
      isActive: t.isActive,
      sortOrder: t.sortOrder,
      memberCount: t._count.members,
      members: t.members.map((m) => m.user),
    }));
  }

  async listForUser(tenantId: string, userId: string) {
    const memberships = await this.prisma.todoTeamMember.findMany({
      where: { tenantId, userId, team: { isActive: true } },
      include: { team: true },
      orderBy: { team: { name: 'asc' } },
    });
    return memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
    }));
  }

  async create(tenantId: string, dto: CreateTodoTeamDto) {
    const maxOrder = await this.prisma.todoTeam.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });
    const team = await this.prisma.todoTeam.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        extraRecipients: this.normalizeEmails(dto.extraRecipients),
        reminderTime: dto.reminderTime ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
    return this.getOne(tenantId, team.id);
  }

  async getOne(tenantId: string, id: string) {
    const team = await this.prisma.todoTeam.findFirst({
      where: { id, tenantId },
      include: {
        members: {
          include: { user: { select: userSelect } },
        },
      },
    });
    if (!team) throw new NotFoundException('Tim nije pronađen.');
    return {
      id: team.id,
      name: team.name,
      extraRecipients: Array.isArray(team.extraRecipients)
        ? (team.extraRecipients as string[])
        : [],
      reminderTime: team.reminderTime,
      isActive: team.isActive,
      sortOrder: team.sortOrder,
      members: team.members.map((m) => m.user),
    };
  }

  async update(tenantId: string, id: string, dto: UpdateTodoTeamDto) {
    await this.getOne(tenantId, id);
    await this.prisma.todoTeam.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.extraRecipients != null
          ? { extraRecipients: this.normalizeEmails(dto.extraRecipients) }
          : {}),
        ...(dto.reminderTime !== undefined ? { reminderTime: dto.reminderTime } : {}),
        ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
      },
    });
    return this.getOne(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    await this.getOne(tenantId, id);
    await this.prisma.todoTeam.delete({ where: { id } });
    return { ok: true };
  }

  async setMembers(tenantId: string, teamId: string, userIds: string[]) {
    await this.getOne(tenantId, teamId);
    const uniqueIds = [...new Set(userIds)];
    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: uniqueIds }, isActive: true },
      select: { id: true },
    });
    if (users.length !== uniqueIds.length) {
      throw new BadRequestException('Neki korisnici nisu pronađeni ili nisu aktivni.');
    }

    await this.prisma.$transaction([
      this.prisma.todoTeamMember.deleteMany({ where: { teamId } }),
      ...uniqueIds.map((userId) =>
        this.prisma.todoTeamMember.create({
          data: { tenantId, teamId, userId },
        }),
      ),
    ]);

    return this.getOne(tenantId, teamId);
  }

  /** User IDs of teammates (shared team, excluding self). Optional filter by teamId. */
  async getTeammateUserIds(
    tenantId: string,
    userId: string,
    teamId?: string,
  ): Promise<string[]> {
    const myMemberships = await this.prisma.todoTeamMember.findMany({
      where: {
        tenantId,
        userId,
        team: { isActive: true, ...(teamId ? { id: teamId } : {}) },
      },
      select: { teamId: true },
    });
    const teamIds = myMemberships.map((m) => m.teamId);
    if (!teamIds.length) return [];

    const teammates = await this.prisma.todoTeamMember.findMany({
      where: {
        tenantId,
        teamId: { in: teamIds },
        userId: { not: userId },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    return teammates.map((t) => t.userId);
  }

  /** Map userId -> team names visible to viewer via shared membership */
  async getSharedTeamNamesByUserId(
    tenantId: string,
    viewerUserId: string,
    ownerUserIds: string[],
  ): Promise<Map<string, string[]>> {
    if (!ownerUserIds.length) return new Map();

    const viewerTeams = await this.prisma.todoTeamMember.findMany({
      where: { tenantId, userId: viewerUserId, team: { isActive: true } },
      select: { teamId: true },
    });
    const viewerTeamIds = viewerTeams.map((t) => t.teamId);
    if (!viewerTeamIds.length) return new Map();

    const rows = await this.prisma.todoTeamMember.findMany({
      where: {
        tenantId,
        teamId: { in: viewerTeamIds },
        userId: { in: ownerUserIds },
      },
      include: { team: { select: { name: true } } },
    });

    const map = new Map<string, string[]>();
    for (const row of rows) {
      const list = map.get(row.userId) ?? [];
      if (!list.includes(row.team.name)) list.push(row.team.name);
      map.set(row.userId, list);
    }
    return map;
  }

  async getActiveTeamsForDigest(tenantId: string) {
    return this.prisma.todoTeam.findMany({
      where: { tenantId, isActive: true },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, displayName: true, isActive: true },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
}
