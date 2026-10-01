import { ProjectWorkOrderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { resolvePeriod } from '../report-date-utils';
import { ReportTemplate, ReportTableResult } from './types';

const TYPE_LABEL: Record<ProjectWorkOrderType, string> = {
  REKLAMACIJA: 'Reklamacija',
  IMPLEMENTACIJA: 'Implementacija',
};

export function projectTimeWorkOrdersExportTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'project_time_work_orders_export',
    title: 'Evidencija rada – radni nalozi (Excel)',
    description:
      'Pojedinačni radni nalozi sa artiklima: Datum, Partner, Tip, ugovor, opisi, Serviser, Projekat, stavke. Jedan red po stavci.',
    paramsSchema: { year: 'number', month: 'number', project: 'string' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const projectName = String(params.project ?? '').trim();
      const hasPeriod = params.year != null || params.month != null;
      const period = hasPeriod
        ? resolvePeriod(ctx.now, {
            year: params.year != null ? Number(params.year) : null,
            month: params.month != null ? Number(params.month) : null,
          })
        : null;

      let projectId: string | undefined;
      if (projectName) {
        const project = await prisma.project.findFirst({
          where: {
            tenantId: ctx.tenantId,
            name: { equals: projectName, mode: 'insensitive' },
          },
          select: { id: true, name: true },
        });
        if (project) projectId = project.id;
      }

      const orders = await prisma.projectWorkOrder.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(projectId ? { projectId } : {}),
          ...(period ? { workDate: { gte: period.from, lte: period.to } } : {}),
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
        take: 200000,
      });

      const rows: Record<string, string | number | null>[] = [];
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
            quantity: null,
            price: null,
            priceWithVat: null,
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

      const titleParts = ['Evidencija rada – radni nalozi'];
      if (projectName) titleParts.push(projectName);
      if (period) titleParts.push(period.label);

      return {
        title: titleParts.join(' – '),
        columns: [
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
        ],
        rows,
        meta: {
          project: projectName || null,
          year: period?.year ?? null,
          month: period?.month ?? null,
        },
      };
    },
  };
}
