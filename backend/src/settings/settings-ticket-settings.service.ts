import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PatchTicketSettingsDto } from './dto/ticket-settings.dto';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class SettingsTicketSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async get(tenantId: string) {
    const s = await this.prisma.ticketSettings.findUnique({
      where: { tenantId },
    });
    if (!s) throw new NotFoundException('Ticket settings not found');
    return s;
  }

  async patch(tenantId: string, actorUserId: string, dto: PatchTicketSettingsDto) {
    const data: Record<string, unknown> = {};
    if (dto.defaultStatus !== undefined) data.defaultStatus = dto.defaultStatus;
    if (dto.defaultType !== undefined) data.defaultType = dto.defaultType;
    if (dto.defaultPriority !== undefined) data.defaultPriority = dto.defaultPriority;
    if (dto.autoInProgressOnAssign !== undefined) data.autoInProgressOnAssign = dto.autoInProgressOnAssign;
    const updated = await this.prisma.ticketSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...(data as object) },
      update: data as object,
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'UPDATE_TICKET_SETTINGS',
      entityType: 'TicketSettings',
      entityId: tenantId,
      metadata: data,
    });
    return updated;
  }
}
