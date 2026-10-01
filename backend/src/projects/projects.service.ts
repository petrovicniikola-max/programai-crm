import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { ProjectWorkOrderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateWorkOrderDto, WorkOrderLineDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { getWorkOrderArticle, listWorkOrderArticles } from './work-order-articles';

function parseWorkDate(input: string): Date {
  const s = input.trim();
  // dd/mm/yyyy | dd.mm.yyyy | dd-mm-yyyy
  const m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      throw new BadRequestException('Invalid workDate');
    }
    return d;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid workDate');
  return d;
}

const TYPE_LABEL: Record<ProjectWorkOrderType, string> = {
  REKLAMACIJA: 'Reklamacija',
  IMPLEMENTACIJA: 'Implementacija',
};

const workOrderInclude = {
  user: { select: { id: true, email: true, displayName: true } },
  lines: { orderBy: { sortOrder: 'asc' as const } },
} as const;

const projectInclude = {
  assignments: { select: { userId: true, user: { select: { id: true, email: true, displayName: true } } } },
  company: { select: { id: true, name: true } },
  distributor: { select: { id: true, name: true } },
} as const;

export const WORK_ORDER_EXPORT_COLUMNS = [
  { key: 'workDate', label: 'Datum' },
  { key: 'partner', label: 'Partner' },
  { key: 'type', label: 'Tip' },
  { key: 'contractNumber', label: 'Serijski broj' },
  { key: 'requestedWork', label: 'Zahtevani radovi' },
  { key: 'performedWork', label: 'Izvršeni radovi' },
  { key: 'serviser', label: 'Serviser' },
  { key: 'project', label: 'Projekat' },
  { key: 'code', label: 'Kod' },
  { key: 'productName', label: 'Proizvod' },
  { key: 'unit', label: 'JM' },
  { key: 'quantity', label: 'Količina' },
  { key: 'price', label: 'Cena' },
  { key: 'priceWithVat', label: 'Cena + PDV' },
  { key: 'hours', label: 'Sati' },
] as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  listArticles() {
    return listWorkOrderArticles();
  }

  private resolveLines(lines: WorkOrderLineDto[]) {
    if (!lines?.length) throw new BadRequestException('At least one article line is required');
    if (lines.length > 2) throw new BadRequestException('Maximum 2 article lines allowed');

    const codes = new Set<string>();
    const resolved = lines.map((line, index) => {
      const code = String(line.code ?? '').trim();
      const article = getWorkOrderArticle(code);
      if (!article) throw new BadRequestException(`Unknown article code: ${code}`);
      if (codes.has(code)) throw new BadRequestException(`Duplicate article code: ${code}`);
      codes.add(code);
      const quantity = Number(line.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException('Line quantity must be greater than 0');
      }
      return {
        code: article.code,
        productName: article.productName,
        unit: article.unit,
        quantity,
        price: article.price,
        priceWithVat: article.priceWithVat,
        sortOrder: index,
      };
    });

    const hours = Number(resolved.reduce((sum, l) => sum + l.quantity, 0).toFixed(2));
    return { resolved, hours };
  }

  private async resolveCompanyId(tenantId: string, companyId?: string | null): Promise<string | null> {
    const id = companyId?.trim();
    if (!id) return null;
    const row = await this.prisma.company.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!row) throw new BadRequestException('Company not found');
    return id;
  }

  private async resolveDistributorId(tenantId: string, distributorId?: string | null): Promise<string | null> {
    const id = distributorId?.trim();
    if (!id) return null;
    const row = await this.prisma.distributor.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!row) throw new BadRequestException('Distributor not found');
    return id;
  }

  async list(tenantId: string, user: { userId: string; role: string }) {
    if (user.role === 'SUPER_ADMIN') {
      return this.prisma.project.findMany({
        where: { tenantId },
        orderBy: [{ createdAt: 'desc' }],
        include: projectInclude,
      });
    }

    return this.prisma.project.findMany({
      where: {
        tenantId,
        assignments: { some: { tenantId, userId: user.userId } },
      },
      orderBy: [{ createdAt: 'desc' }],
      include: projectInclude,
    });
  }

  async create(tenantId: string, dto: CreateProjectDto) {
    const assignedUserIds = (dto.assignedUserIds ?? []).map((x) => x.trim()).filter(Boolean);
    const startDate = new Date(dto.startDate);
    if (Number.isNaN(startDate.getTime())) throw new BadRequestException('Invalid startDate');
    const endDateRaw = dto.endDate ?? null;
    const endDate = endDateRaw ? new Date(String(endDateRaw)) : null;
    if (endDateRaw && Number.isNaN(endDate?.getTime() ?? NaN)) throw new BadRequestException('Invalid endDate');

    const companyId = await this.resolveCompanyId(tenantId, dto.companyId);
    const distributorId = await this.resolveDistributorId(tenantId, dto.distributorId);

    return this.prisma.project.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        startDate,
        endDate,
        companyId,
        distributorId,
        assignments: assignedUserIds.length
          ? {
              createMany: {
                data: assignedUserIds.map((userId) => ({ tenantId, userId })),
                skipDuplicates: true,
              },
            }
          : undefined,
      },
      include: projectInclude,
    });
  }

  private async assertProjectAccess(tenantId: string, projectId: string, user: { userId: string; role: string }) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      include: { assignments: { select: { userId: true } } },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (user.role === 'SUPER_ADMIN') return project;
    const assigned = project.assignments.some((a) => a.userId === user.userId);
    if (!assigned) throw new ForbiddenException('Not assigned to project');
    return project;
  }

  async get(tenantId: string, projectId: string, user: { userId: string; role: string }) {
    await this.assertProjectAccess(tenantId, projectId, user);
    return this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      include: projectInclude,
    });
  }

  async update(tenantId: string, projectId: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, tenantId } });
    if (!project) throw new NotFoundException('Project not found');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.startDate !== undefined) {
      const d = new Date(dto.startDate);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid startDate');
      data.startDate = d;
    }
    if (dto.endDate !== undefined) {
      const raw = dto.endDate;
      if (raw == null || String(raw).trim() === '') {
        data.endDate = null;
      } else {
        const d = new Date(String(raw));
        if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid endDate');
        data.endDate = d;
      }
    }
    if (dto.companyId !== undefined) {
      data.companyId = await this.resolveCompanyId(tenantId, dto.companyId);
    }
    if (dto.distributorId !== undefined) {
      data.distributorId = await this.resolveDistributorId(tenantId, dto.distributorId);
    }

    const assignedUserIds =
      dto.assignedUserIds !== undefined
        ? dto.assignedUserIds.map((x) => x.trim()).filter(Boolean)
        : undefined;

    // Replace assignment list if provided
    if (assignedUserIds) {
      await this.prisma.projectAssignment.deleteMany({ where: { tenantId, projectId } });
      if (assignedUserIds.length) {
        await this.prisma.projectAssignment.createMany({
          data: assignedUserIds.map((userId) => ({ tenantId, projectId, userId })),
          skipDuplicates: true,
        });
      }
    }

    return this.prisma.project.update({
      where: { id: projectId },
      data,
      include: projectInclude,
    });
  }

  async remove(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, tenantId } });
    if (!project) throw new NotFoundException('Project not found');
    await this.prisma.project.delete({ where: { id: projectId } });
    return { ok: true };
  }

  async listWorkOrders(tenantId: string, projectId: string, user: { userId: string; role: string }) {
    await this.assertProjectAccess(tenantId, projectId, user);
    return this.prisma.projectWorkOrder.findMany({
      where: { tenantId, projectId },
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
      include: workOrderInclude,
    });
  }

  async createWorkOrder(
    tenantId: string,
    projectId: string,
    actor: { userId: string; role: string },
    dto: CreateWorkOrderDto,
  ) {
    const project = await this.assertProjectAccess(tenantId, projectId, actor);
    const isAssigned =
      actor.role === 'SUPER_ADMIN' ||
      (await this.prisma.projectAssignment.findFirst({
        where: { tenantId, projectId: project.id, userId: actor.userId },
        select: { id: true },
      }));
    if (!isAssigned) throw new ForbiddenException('Not assigned to project');

    const { resolved, hours } = this.resolveLines(dto.lines);
    const workDate = dto.today ? new Date() : dto.workDate ? parseWorkDate(dto.workDate) : new Date();

    return this.prisma.projectWorkOrder.create({
      data: {
        tenantId,
        projectId,
        userId: actor.userId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        type: dto.type,
        contractNumber: dto.contractNumber?.trim() || null,
        requestedWork: dto.requestedWork?.trim() || null,
        performedWork: dto.performedWork?.trim() || null,
        hours,
        workDate,
        lines: {
          create: resolved.map((line) => ({
            tenantId,
            ...line,
          })),
        },
      },
      include: workOrderInclude,
    });
  }

  async updateWorkOrder(tenantId: string, id: string, dto: UpdateWorkOrderDto) {
    const wo = await this.prisma.projectWorkOrder.findFirst({ where: { tenantId, id } });
    if (!wo) throw new NotFoundException('Work order not found');

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.contractNumber !== undefined) data.contractNumber = dto.contractNumber?.trim() || null;
    if (dto.requestedWork !== undefined) data.requestedWork = dto.requestedWork?.trim() || null;
    if (dto.performedWork !== undefined) data.performedWork = dto.performedWork?.trim() || null;
    if (dto.workDate !== undefined) data.workDate = parseWorkDate(dto.workDate);

    if (dto.lines !== undefined) {
      const { resolved, hours } = this.resolveLines(dto.lines);
      data.hours = hours;
      return this.prisma.$transaction(async (tx) => {
        await tx.projectWorkOrderLine.deleteMany({ where: { tenantId, workOrderId: id } });
        return tx.projectWorkOrder.update({
          where: { id },
          data: {
            ...data,
            lines: {
              create: resolved.map((line) => ({
                tenantId,
                ...line,
              })),
            },
          },
          include: workOrderInclude,
        });
      });
    }

    if (dto.hours !== undefined) data.hours = dto.hours;

    return this.prisma.projectWorkOrder.update({
      where: { id },
      data,
      include: workOrderInclude,
    });
  }

  async removeWorkOrder(tenantId: string, id: string) {
    const wo = await this.prisma.projectWorkOrder.findFirst({ where: { tenantId, id } });
    if (!wo) throw new NotFoundException('Work order not found');
    await this.prisma.projectWorkOrder.delete({ where: { id } });
    return { ok: true };
  }

  async stats(tenantId: string, projectId: string, user: { userId: string; role: string }) {
    await this.assertProjectAccess(tenantId, projectId, user);

    const rows = await this.prisma.projectWorkOrder.findMany({
      where: { tenantId, projectId },
      select: { hours: true, userId: true, user: { select: { email: true, displayName: true } } },
    });

    let totalHours = 0;
    const byUser = new Map<string, { userId: string; email: string; displayName: string | null; hours: number }>();
    for (const r of rows) {
      totalHours += r.hours;
      const prev = byUser.get(r.userId);
      if (prev) {
        prev.hours += r.hours;
      } else {
        byUser.set(r.userId, {
          userId: r.userId,
          email: r.user.email,
          displayName: r.user.displayName ?? null,
          hours: r.hours,
        });
      }
    }

    return {
      totalHours,
      hoursByUser: Array.from(byUser.values()).sort((a, b) => b.hours - a.hours),
    };
  }

  async buildWorkOrderExportRows(tenantId: string, projectId?: string) {
    const orders = await this.prisma.projectWorkOrder.findMany({
      where: {
        tenantId,
        ...(projectId ? { projectId } : {}),
      },
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        user: { select: { email: true, displayName: true } },
        project: {
          select: {
            name: true,
            distributor: { select: { name: true } },
          },
        },
        lines: { orderBy: { sortOrder: 'asc' } },
      },
    });

    const rows: Record<string, string | number>[] = [];
    for (const wo of orders) {
      const partner = wo.project.distributor?.name ?? '';
      const typeLabel = wo.type ? TYPE_LABEL[wo.type] : '';
      const serviser = wo.user.displayName || wo.user.email;
      const workDate = wo.workDate.toISOString().slice(0, 10);
      const base = {
        workDate,
        partner,
        type: typeLabel,
        contractNumber: wo.contractNumber ?? '',
        requestedWork: wo.requestedWork ?? '',
        performedWork: wo.performedWork ?? '',
        serviser,
        project: wo.project.name,
        hours: Number(wo.hours.toFixed(2)),
      };

      if (!wo.lines.length) {
        rows.push({
          ...base,
          code: '',
          productName: '',
          unit: '',
          quantity: '',
          price: '',
          priceWithVat: '',
        });
        continue;
      }

      for (const line of wo.lines) {
        rows.push({
          ...base,
          code: line.code,
          productName: line.productName,
          unit: line.unit,
          quantity: Number(line.quantity.toFixed(2)),
          price: Number(line.price.toFixed(2)),
          priceWithVat: Number(line.priceWithVat.toFixed(2)),
        });
      }
    }
    return rows;
  }

  async exportWorkOrdersXlsx(
    tenantId: string,
    projectId: string,
    user: { userId: string; role: string },
  ): Promise<Buffer> {
    await this.assertProjectAccess(tenantId, projectId, user);
    const rows = await this.buildWorkOrderExportRows(tenantId, projectId);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Radni nalozi');
    ws.addRow(WORK_ORDER_EXPORT_COLUMNS.map((c) => c.label));
    for (const row of rows) {
      ws.addRow(WORK_ORDER_EXPORT_COLUMNS.map((c) => (row[c.key] ?? '') as any));
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
