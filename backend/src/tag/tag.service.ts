import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketTagIdsDto } from '../ticket/dto/ticket-tags.dto';

@Injectable()
export class TagService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, name: string) {
    const normalized = name.trim();
    const existing = await this.prisma.tag.findUnique({
      where: { tenantId_name: { tenantId, name: normalized } },
    });
    if (existing) throw new ConflictException(`Tag already exists: ${normalized}`);
    return this.prisma.tag.create({
      data: { tenantId, name: normalized },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.tag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async ensureTicketInTenant(tenantId: string, ticketId: string): Promise<void> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
  }

  async assignToTicket(tenantId: string, ticketId: string, dto: TicketTagIdsDto) {
    await this.ensureTicketInTenant(tenantId, ticketId);
    for (const tagId of dto.tagIds) {
      const tag = await this.prisma.tag.findFirst({ where: { id: tagId, tenantId } });
      if (!tag) throw new NotFoundException(`Tag not found: ${tagId}`);
    }
    const created: unknown[] = [];
    for (const tagId of dto.tagIds) {
      try {
        const tt = await this.prisma.ticketTag.upsert({
          where: {
            tenantId_ticketId_tagId: { tenantId, ticketId, tagId },
          },
          create: { tenantId, ticketId, tagId },
          update: {},
        });
        created.push(tt);
      } catch {
        // ignore duplicate
      }
    }
    return this.prisma.ticketTag.findMany({
      where: { tenantId, ticketId },
      include: { tag: true },
    });
  }

  async unassignFromTicket(tenantId: string, ticketId: string, dto: TicketTagIdsDto) {
    await this.ensureTicketInTenant(tenantId, ticketId);
    await this.prisma.ticketTag.deleteMany({
      where: { tenantId, ticketId, tagId: { in: dto.tagIds } },
    });
    return { deleted: dto.tagIds.length };
  }

  async remove(tenantId: string, id: string) {
    const tag = await this.prisma.tag.findFirst({ where: { id, tenantId } });
    if (!tag) throw new NotFoundException('Tag not found');
    return this.prisma.tag.delete({ where: { id } });
  }
}
