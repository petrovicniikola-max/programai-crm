import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetUserPasswordDto } from './dto/set-user-password.dto';
import { AuditLogService } from './audit-log.service';
import { parseDateOnly } from '../leave/leave-date.util';

@Injectable()
export class SettingsUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private async resolveRoleFields(input: { role?: UserRole; roleId?: string }) {
    if (input.roleId) {
      const assigned = await this.prisma.role.findUnique({ where: { id: input.roleId } });
      if (!assigned) throw new NotFoundException('Uloga nije pronađena.');
      if (!assigned.isActive) throw new BadRequestException('Uloga nije aktivna.');
      const enumVal = Object.values(UserRole).includes(assigned.slug as UserRole)
        ? (assigned.slug as UserRole)
        : UserRole.USER;
      return { roleId: assigned.id, role: enumVal };
    }
    if (input.role) {
      const assigned = await this.prisma.role.findUnique({ where: { slug: input.role } });
      return { role: input.role, roleId: assigned?.id ?? null };
    }
    return null;
  }

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        roleId: true,
        isActive: true,
        createdAt: true,
        receiveLicenceExpiryEmails: true,
        employmentDate: true,
        leaveApproverId: true,
        jobTitle: true,
        employmentContractType: true,
        contractEndDate: true,
        totalWorkExperienceYears: true,
      },
      orderBy: { email: 'asc' },
    });
  }

  async create(tenantId: string, actorUserId: string, dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const roleFields = await this.resolveRoleFields({ role: dto.role, roleId: dto.roleId });
    if (!roleFields) throw new BadRequestException('role ili roleId je obavezan.');
    if (roleFields.role === 'USER' && !dto.companyId?.trim()) {
      throw new BadRequestException('companyId is required when role is USER');
    }
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
        role: roleFields.role,
        roleId: roleFields.roleId,
        companyId: dto.companyId?.trim() || null,
        receiveLicenceExpiryEmails: dto.receiveLicenceExpiryEmails ?? false,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        roleId: true,
        companyId: true,
        isActive: true,
        createdAt: true,
        receiveLicenceExpiryEmails: true,
      },
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
    const roleFields = await this.resolveRoleFields({ role: dto.role, roleId: dto.roleId });
    if (roleFields) {
      data.role = roleFields.role;
      data.roleId = roleFields.roleId;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.receiveLicenceExpiryEmails !== undefined)
      data.receiveLicenceExpiryEmails = dto.receiveLicenceExpiryEmails;
    if (dto.employmentDate !== undefined) {
      data.employmentDate = dto.employmentDate ? parseDateOnly(dto.employmentDate) : null;
    }
    if (dto.leaveApproverId !== undefined) data.leaveApproverId = dto.leaveApproverId;
    if (dto.jobTitle !== undefined) data.jobTitle = dto.jobTitle;
    if (dto.employmentContractType !== undefined)
      data.employmentContractType = dto.employmentContractType;
    if (dto.contractEndDate !== undefined) {
      data.contractEndDate = dto.contractEndDate ? parseDateOnly(dto.contractEndDate) : null;
    }
    if (dto.totalWorkExperienceYears !== undefined)
      data.totalWorkExperienceYears = dto.totalWorkExperienceYears;
    const updated = await this.prisma.user.update({
      where: { id },
      data: data as object,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        roleId: true,
        isActive: true,
        createdAt: true,
        receiveLicenceExpiryEmails: true,
        employmentDate: true,
        leaveApproverId: true,
        jobTitle: true,
        employmentContractType: true,
        contractEndDate: true,
        totalWorkExperienceYears: true,
      },
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
