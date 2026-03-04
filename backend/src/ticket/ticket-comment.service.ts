import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class TicketCommentService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureTicketInTenant(tenantId: string, ticketId: string): Promise<void> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
  }

  async create(tenantId: string, ticketId: string, authorId: string, dto: CreateCommentDto) {
    await this.ensureTicketInTenant(tenantId, ticketId);
    return this.prisma.ticketComment.create({
      data: { tenantId, ticketId, authorId, body: dto.body },
      include: { author: { select: { id: true, email: true } } },
    });
  }

  async findAll(tenantId: string, ticketId: string) {
    await this.ensureTicketInTenant(tenantId, ticketId);
    return this.prisma.ticketComment.findMany({
      where: { tenantId, ticketId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, email: true } } },
    });
  }
}
