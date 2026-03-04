import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TicketTaskService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureTicketInTenant(tenantId: string, ticketId: string): Promise<void> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
  }

  async ensureTaskInTicket(tenantId: string, ticketId: string, taskId: string): Promise<void> {
    const task = await this.prisma.ticketTask.findFirst({
      where: { id: taskId, tenantId, ticketId },
    });
    if (!task) throw new NotFoundException('Task not found');
  }

  async create(tenantId: string, ticketId: string, dto: CreateTaskDto) {
    await this.ensureTicketInTenant(tenantId, ticketId);
    const orderNo = dto.orderNo ?? 0;
    return this.prisma.ticketTask.create({
      data: { tenantId, ticketId, title: dto.title, orderNo },
    });
  }

  async findAll(tenantId: string, ticketId: string) {
    await this.ensureTicketInTenant(tenantId, ticketId);
    return this.prisma.ticketTask.findMany({
      where: { tenantId, ticketId },
      orderBy: { orderNo: 'asc' },
    });
  }

  async update(tenantId: string, ticketId: string, taskId: string, dto: UpdateTaskDto) {
    await this.ensureTaskInTicket(tenantId, ticketId, taskId);
    return this.prisma.ticketTask.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.isDone !== undefined && { isDone: dto.isDone }),
        ...(dto.orderNo !== undefined && { orderNo: dto.orderNo }),
      },
    });
  }

  async remove(tenantId: string, ticketId: string, taskId: string) {
    await this.ensureTaskInTicket(tenantId, ticketId, taskId);
    return this.prisma.ticketTask.delete({ where: { id: taskId } });
  }
}
