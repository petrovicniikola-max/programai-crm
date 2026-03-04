import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetUserPasswordDto } from './dto/set-user-password.dto';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class SettingsUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, displayName: true, role: true, isActive: true, createdAt: true },
      orderBy: { email: 'asc' },
    });
  }

  async create(tenantId: string, actorUserId: string, dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) throw new ConflictException('User with this email already exists');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        displayName: dto.displayName?.trim() || null,
        passwordHash,
        role: dto.role,
      },
      select: { id: true, email: true, displayName: true, role: true, isActive: true, createdAt: true },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'CREATE_USER',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });
    return user;
  }

  async update(tenantId: string, actorUserId: string, id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    const data: Record<string, unknown> = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    const updated = await this.prisma.user.update({
      where: { id },
      data: data as object,
      select: { id: true, email: true, displayName: true, role: true, isActive: true, createdAt: true },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'UPDATE_USER',
      entityType: 'User',
      entityId: id,
      metadata: data,
    });
    return updated;
  }

  async resetPassword(tenantId: string, actorUserId: string, id: string, dto: SetUserPasswordDto) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'RESET_PASSWORD',
      entityType: 'User',
      entityId: id,
    });
    return { ok: true };
  }
}
