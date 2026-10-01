import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PatchLeaveSettingsDto, CreateHolidayDto } from './dto/leave-settings.dto';
import { parseDateOnly } from '../leave/leave-date.util';
import { DEFAULT_SENIORITY_TABLE } from '../leave/leave-balance.service';

@Injectable()
export class SettingsLeaveService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(tenantId: string) {
    const row = await this.prisma.tenantLeaveSettings.findUnique({ where: { tenantId } });
    if (row) return row;
    return this.prisma.tenantLeaveSettings.create({
      data: {
        tenantId,
        seniorityBonusTable: DEFAULT_SENIORITY_TABLE as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async patchSettings(tenantId: string, dto: PatchLeaveSettingsDto) {
    if (dto.defaultApproverId) {
      const u = await this.prisma.user.findFirst({
        where: { id: dto.defaultApproverId, tenantId },
      });
      if (!u) throw new BadRequestException('defaultApproverId not found');
    }
    await this.getSettings(tenantId);
    return this.prisma.tenantLeaveSettings.update({
      where: { tenantId },
      data: {
        ...(dto.defaultApproverId !== undefined && { defaultApproverId: dto.defaultApproverId }),
        ...(dto.minAnnualDays !== undefined && { minAnnualDays: dto.minAnnualDays }),
        ...(dto.personalDaysPerYear !== undefined && { personalDaysPerYear: dto.personalDaysPerYear }),
        ...(dto.paidAbsenceMaxDays !== undefined && { paidAbsenceMaxDays: dto.paidAbsenceMaxDays }),
        ...(dto.seniorityBonusTable !== undefined && {
          seniorityBonusTable: dto.seniorityBonusTable as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.companyAddress !== undefined && { companyAddress: dto.companyAddress }),
        ...(dto.companyCity !== undefined && { companyCity: dto.companyCity }),
        ...(dto.reminderAfterMonthDay !== undefined && {
          reminderAfterMonthDay: dto.reminderAfterMonthDay,
        }),
        ...(dto.decisionNotificationEmails !== undefined && {
          decisionNotificationEmails: dto.decisionNotificationEmails,
        }),
      },
    });
  }

  async listHolidays(tenantId: string) {
    return this.prisma.publicHoliday.findMany({
      where: { tenantId },
      orderBy: { date: 'asc' },
    });
  }

  async createHoliday(tenantId: string, dto: CreateHolidayDto) {
    const date = parseDateOnly(dto.date);
    return this.prisma.publicHoliday.create({
      data: {
        tenantId,
        date,
        name: dto.name.trim(),
        isRecurring: dto.isRecurring ?? false,
      },
    });
  }

  async deleteHoliday(tenantId: string, id: string) {
    const row = await this.prisma.publicHoliday.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Holiday not found');
    await this.prisma.publicHoliday.delete({ where: { id } });
    return { ok: true };
  }
}
