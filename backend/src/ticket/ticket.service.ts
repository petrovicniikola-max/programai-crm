import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, TicketStatus, TicketType } from '@prisma/client';
import { normalisePhone } from '../common/util/phone.util';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketListQueryDto } from './dto/ticket-list-query.dto';
import { QuickCallDto } from './dto/quick-call.dto';

export interface QuickCallResult {
  ticket: { id: string; key: string; title: string; type: string; status: string; contactId: string | null; companyId: string | null; [k: string]: unknown };
  contact: { id: string; name: string; companyId: string | null; [k: string]: unknown };
  company: { id: string; name: string; [k: string]: unknown } | null;
}

@Injectable()
export class TicketService {
  constructor(private readonly prisma: PrismaService) {}

  /** prefix 'T' = manual Create Ticket, 'Q' = Quick call */
  private async nextKey(tenantId: string, prefix: 'T' | 'Q' = 'T', tx?: Prisma.TransactionClient): Promise<string> {
    const prisma = tx ?? this.prisma;
    const count = await prisma.ticket.count({
      where: { tenantId, key: { startsWith: `${prefix}-` } },
    });
    return `${prefix}-${String(count + 1).padStart(6, '0')}`;
  }

  async create(tenantId: string, dto: CreateTicketDto, assigneeId?: string) {
    const key = dto.key ?? (await this.nextKey(tenantId, 'T'));
    const existing = await this.prisma.ticket.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    if (existing) throw new ConflictException(`Ticket key already exists: ${key}`);
    return this.prisma.ticket.create({
      data: {
        tenantId,
        key,
        title: dto.title,
        description: dto.description ?? undefined,
        status: dto.status ?? 'OPEN',
        type: dto.type ?? 'OTHER',
        companyId: dto.companyId ?? undefined,
        contactId: dto.contactId ?? undefined,
        assigneeId: assigneeId ?? dto.assigneeId ?? undefined,
        createdByUserId: dto.createdByUserId ?? assigneeId ?? undefined,
        ...(dto.callOccurredAt !== undefined && { callOccurredAt: new Date(dto.callOccurredAt) }),
        ...(dto.callDurationMinutes !== undefined && { callDurationMinutes: dto.callDurationMinutes }),
        reportedBy: dto.reportedBy ?? undefined,
        putIAngazovanje: dto.putIAngazovanje ?? undefined,
        tokPrijave: dto.tokPrijave ?? undefined,
        zakljucak: dto.zakljucak ?? undefined,
        potpisOvlascenogLica: dto.potpisOvlascenogLica ?? undefined,
        ...(dto.ticketDate !== undefined && { ticketDate: new Date(dto.ticketDate) }),
      },
      include: { company: true, contact: true, assignee: true, createdBy: true },
    });
  }

  async findAll(tenantId: string, q: TicketListQueryDto) {
    const where: Record<string, unknown> = { tenantId };
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;
    if (q.assigneeId === 'unassigned') where.assigneeId = null;
    else if (q.assigneeId) where.assigneeId = q.assigneeId;
    if (q.createdByUserId) where.createdByUserId = q.createdByUserId;
    if (q.companyId) where.companyId = q.companyId;

    const page = Math.max(1, q.page ?? 1);
    const take = Math.min(100, Math.max(1, q.limit ?? 20));
    const skip = (page - 1) * take;

    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: {
          company: true,
          contact: true,
          assignee: { select: { id: true, email: true, displayName: true } },
          createdBy: { select: { id: true, email: true, displayName: true } },
        },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { items, total, page, limit: take, totalPages: Math.ceil(total / take) };
  }

  async findOne(tenantId: string, id: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenantId },
      include: {
        company: true,
        contact: true,
        assignee: { select: { id: true, email: true, displayName: true } },
        createdBy: { select: { id: true, email: true, displayName: true } },
        ticketTags: { include: { tag: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const [commentsCount, openTasksCount] = await Promise.all([
      this.prisma.ticketComment.count({ where: { tenantId, ticketId: id } }),
      this.prisma.ticketTask.count({ where: { tenantId, ticketId: id, isDone: false } }),
    ]);
    const tags = ticket.ticketTags.map((tt) => ({ id: tt.tag.id, name: tt.tag.name }));
    return { ...ticket, commentsCount, openTasksCount, tags };
  }

  async update(tenantId: string, id: string, dto: UpdateTicketDto) {
    await this.findOne(tenantId, id);
    if (dto.key) {
      const existing = await this.prisma.ticket.findFirst({
        where: { tenantId, key: dto.key },
      });
      if (existing && existing.id !== id)
        throw new ConflictException(`Ticket key already exists: ${dto.key}`);
    }
    return this.prisma.ticket.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.status !== undefined && { status: dto.status as TicketStatus }),
        ...(dto.type !== undefined && { type: dto.type as TicketType }),
        ...(dto.companyId !== undefined && { companyId: dto.companyId || null }),
        ...(dto.contactId !== undefined && { contactId: dto.contactId || null }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId || null }),
        ...(dto.key !== undefined && { key: dto.key }),
        ...(dto.description !== undefined && { description: dto.description ?? null }),
        ...(dto.callOccurredAt !== undefined && { callOccurredAt: new Date(dto.callOccurredAt) }),
        ...(dto.callDurationMinutes !== undefined && { callDurationMinutes: dto.callDurationMinutes }),
      },
      include: { company: true, contact: true, assignee: true },
    });
  }

  async updateStatus(tenantId: string, id: string, status: TicketStatus) {
    await this.findOne(tenantId, id);
    return this.prisma.ticket.update({
      where: { id },
      data: { status },
      include: { company: true, contact: true, assignee: true },
    });
  }

  async setCallTimeNow(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.ticket.update({
      where: { id },
      data: { callOccurredAt: new Date() },
      include: { company: true, contact: true, assignee: true },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.ticket.delete({ where: { id } });
  }

  /** Lookup contact + company for Quick Call autofill. Tries phone, contactName, companyId, companyName, pib, mb. */
  async lookupClientForQuickCall(
    tenantId: string,
    params: {
      phone?: string;
      contactName?: string;
      companyName?: string;
      companyId?: string;
      pib?: string;
      mb?: string;
    },
  ): Promise<{
    contact?: { id: string; name: string; companyId: string | null; phones: { phoneRaw: string }[] };
    company?: { id: string; name: string; pib: string | null; mb: string | null };
  }> {
    const { phone, contactName, companyName, companyId, pib, mb } = params;

    if (phone) {
      const phoneNorm = normalisePhone(phone);
      if (phoneNorm) {
        const cp = await this.prisma.contactPhone.findUnique({
          where: { tenantId_phoneNormalised: { tenantId, phoneNormalised: phoneNorm } },
          include: { contact: { include: { company: true, phones: { select: { phoneRaw: true } } } } },
        });
        if (cp?.contact) {
          const c = cp.contact;
          return {
            contact: { id: c.id, name: c.name, companyId: c.companyId, phones: c.phones },
            company: c.company ? { id: c.company.id, name: c.company.name, pib: c.company.pib, mb: c.company.mb } : undefined,
          };
        }
      }
    }

    if (contactName) {
      const contact = await this.prisma.contact.findFirst({
        where: { tenantId, name: { contains: contactName, mode: 'insensitive' } },
        include: { company: true, phones: { select: { phoneRaw: true } } },
      });
      if (contact) {
        return {
          contact: { id: contact.id, name: contact.name, companyId: contact.companyId, phones: contact.phones },
          company: contact.company ? { id: contact.company.id, name: contact.company.name, pib: contact.company.pib, mb: contact.company.mb } : undefined,
        };
      }
    }

    if (companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: companyId, tenantId },
      });
      if (company) {
        const contact = await this.prisma.contact.findFirst({
          where: { tenantId, companyId: company.id },
          include: { phones: { select: { phoneRaw: true } } },
        });
        return {
          contact: contact ? { id: contact.id, name: contact.name, companyId: contact.companyId, phones: contact.phones } : undefined,
          company: { id: company.id, name: company.name, pib: company.pib, mb: company.mb },
        };
      }
    }

    if (companyName) {
      const company = await this.prisma.company.findFirst({
        where: { tenantId, name: { contains: companyName, mode: 'insensitive' } },
      });
      if (company) {
        const contact = await this.prisma.contact.findFirst({
          where: { tenantId, companyId: company.id },
          include: { phones: { select: { phoneRaw: true } } },
        });
        return {
          contact: contact ? { id: contact.id, name: contact.name, companyId: contact.companyId, phones: contact.phones } : undefined,
          company: { id: company.id, name: company.name, pib: company.pib, mb: company.mb },
        };
      }
    }

    if (pib) {
      const company = await this.prisma.company.findFirst({
        where: { tenantId, pib },
      });
      if (company) {
        const contact = await this.prisma.contact.findFirst({
          where: { tenantId, companyId: company.id },
          include: { phones: { select: { phoneRaw: true } } },
        });
        return {
          contact: contact ? { id: contact.id, name: contact.name, companyId: contact.companyId, phones: contact.phones } : undefined,
          company: { id: company.id, name: company.name, pib: company.pib, mb: company.mb },
        };
      }
    }

    if (mb) {
      const company = await this.prisma.company.findFirst({
        where: { tenantId, mb },
      });
      if (company) {
        const contact = await this.prisma.contact.findFirst({
          where: { tenantId, companyId: company.id },
          include: { phones: { select: { phoneRaw: true } } },
        });
        return {
          contact: contact ? { id: contact.id, name: contact.name, companyId: contact.companyId, phones: contact.phones } : undefined,
          company: { id: company.id, name: company.name, pib: company.pib, mb: company.mb },
        };
      }
    }

    return {};
  }

  async quickCall(tenantId: string, dto: QuickCallDto, createdByUserId?: string): Promise<QuickCallResult> {
    const phoneRaw = dto.phone?.trim() || null;
    const phoneNormalised = phoneRaw ? normalisePhone(phoneRaw) : null;
    const isCentrala = !phoneRaw;

    return this.prisma.$transaction(async (tx) => {
      let companyId: string | null = null;

      if (dto.companyName?.trim()) {
        const name = dto.companyName.trim();
        const pib = dto.pib?.trim() || undefined;
        const mb = dto.mb?.trim() || undefined;
        let company =
          (pib && (await tx.company.findFirst({ where: { tenantId, pib } }))) ||
          (await tx.company.findFirst({
            where: { tenantId, name: { equals: name, mode: 'insensitive' } },
          }));
        if (!company) {
          company = await tx.company.create({
            data: { tenantId, name, ...(pib && { pib }), ...(mb && { mb }) },
          });
        } else if (mb && !company.mb) {
          company = await tx.company.update({
            where: { id: company.id },
            data: { mb },
          });
        }
        companyId = company.id;
      } else if (dto.pib?.trim()) {
        const company = await tx.company.findFirst({
          where: { tenantId, pib: dto.pib.trim() },
        });
        if (company) companyId = company.id;
      } else if (dto.companyId?.trim()) {
        const company = await tx.company.findFirst({
          where: { id: dto.companyId.trim(), tenantId },
        });
        if (company) companyId = company.id;
      }

      let contact: { id: string; name: string; companyId: string | null; [k: string]: unknown };
      const contactName = dto.contactName?.trim() || (isCentrala ? 'Centrala' : 'Nepoznat');

      if (isCentrala) {
        const existing = companyId
          ? await tx.contact.findFirst({
              where: { tenantId, companyId, name: { contains: contactName, mode: 'insensitive' } },
            })
          : null;
        if (existing) {
          contact = existing;
          if (companyId !== null && contact.companyId !== companyId) {
            contact = await tx.contact.update({
              where: { id: contact.id },
              data: { companyId },
            });
          }
        } else {
          contact = await tx.contact.create({
            data: { tenantId, companyId, name: contactName },
          });
        }
      } else {
        const existingPhone = await tx.contactPhone.findUnique({
          where: { tenantId_phoneNormalised: { tenantId, phoneNormalised: phoneNormalised! } },
          include: { contact: { include: { company: true } } },
        });

        if (existingPhone) {
          contact = existingPhone.contact;
          if (companyId === null && contact.companyId) companyId = contact.companyId;
          if (companyId !== null && contact.companyId !== companyId) {
            contact = await tx.contact.update({
              where: { id: contact.id },
              data: { companyId },
            });
          }
        } else {
          const newContact = await tx.contact.create({
            data: { tenantId, companyId, name: contactName },
          });
          await tx.contactPhone.create({
            data: {
              tenantId,
              contactId: newContact.id,
              phoneRaw: phoneRaw!,
              phoneNormalised: phoneNormalised!,
              isPrimary: true,
            },
          });
          contact = newContact;
        }
      }

      const finalContactName = dto.contactName?.trim() || contact.name;
      const key = await this.nextKey(tenantId, 'Q', tx);

      const callOccurredAt = dto.callOccurredAt ? new Date(dto.callOccurredAt) : new Date();
      const callDurationMinutes = dto.callDurationMinutes ?? null;
      let ticketType: TicketType = 'CALL';
      if (dto.conversationKind === 'SUPPORT') ticketType = 'SUPPORT';
      else if (dto.conversationKind === 'SALES') ticketType = 'SALES';

      const ticket = await tx.ticket.create({
        data: {
          tenantId,
          key,
          type: ticketType,
          status: 'OPEN',
          title: `Poziv: ${finalContactName || phoneRaw || 'Centrala'}`,
          description: dto.summary ?? null,
          companyId,
          contactId: contact.id,
          assigneeId: dto.assigneeId ?? null,
          createdByUserId: createdByUserId ?? null,
          phoneRaw: phoneRaw ?? null,
          contactName: finalContactName,
          callOccurredAt,
          callDurationMinutes,
        },
        include: {
          company: true,
          contact: true,
          assignee: { select: { id: true, email: true, displayName: true } },
          createdBy: { select: { id: true, email: true, displayName: true } },
        },
      });

      const company = companyId
        ? await tx.company.findUnique({ where: { id: companyId } })
        : null;

      return {
        ticket,
        contact: contact as QuickCallResult['contact'],
        company: company as QuickCallResult['company'],
      };
    });
  }
}
