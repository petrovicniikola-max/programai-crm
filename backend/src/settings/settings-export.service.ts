import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsExportService {
  constructor(private readonly prisma: PrismaService) {}

  async companiesCsv(tenantId: string): Promise<string> {
    const rows = await this.prisma.company.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    const header = 'id,name,pib,mb,address,city,postalCode,createdAt';
    const lines = rows.map(
      (r) =>
        `${r.id},${escapeCsv(r.name)},${escapeCsv(r.pib ?? '')},${escapeCsv(r.mb ?? '')},${escapeCsv(r.address ?? '')},${escapeCsv(r.city ?? '')},${escapeCsv(r.postalCode ?? '')},${r.createdAt.toISOString()}`,
    );
    return [header, ...lines].join('\r\n');
  }

  async contactsCsv(tenantId: string): Promise<string> {
    const rows = await this.prisma.contact.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    const header = 'id,name,companyId,createdAt';
    const lines = rows.map((r) => `${r.id},${escapeCsv(r.name)},${r.companyId ?? ''},${r.createdAt.toISOString()}`);
    return [header, ...lines].join('\r\n');
  }

  async ticketsCsv(tenantId: string): Promise<string> {
    const rows = await this.prisma.ticket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
    const header =
      'id,key,title,status,type,companyId,contactId,assigneeId,createdAt,updatedAt,callOccurredAt,callDurationMinutes';
    const lines = rows.map(
      (r) =>
        `${r.id},${escapeCsv(r.key)},${escapeCsv(r.title)},${r.status},${r.type},${r.companyId ?? ''},${r.contactId ?? ''},${r.assigneeId ?? ''},${r.createdAt.toISOString()},${r.updatedAt.toISOString()},${r.callOccurredAt?.toISOString() ?? ''},${r.callDurationMinutes ?? ''}`,
    );
    return [header, ...lines].join('\r\n');
  }

  async formsCsv(tenantId: string, formIds?: string[]): Promise<string> {
    const where = formIds?.length
      ? { tenantId, id: { in: formIds } }
      : { tenantId };
    const rows = await this.prisma.form.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
    const header = 'id,title,description,status,createdAt,updatedAt,publishedAt';
    const lines = rows.map(
      (r) =>
        `${r.id},${escapeCsv(r.title)},${escapeCsv(r.description ?? '')},${r.status},${r.createdAt.toISOString()},${r.updatedAt.toISOString()},${r.publishedAt?.toISOString() ?? ''}`,
    );
    return [header, ...lines].join('\r\n');
  }
}

function escapeCsv(val: string): string {
  if (/[,"\r\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}
