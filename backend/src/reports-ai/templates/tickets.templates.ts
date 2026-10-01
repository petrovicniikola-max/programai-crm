import { PrismaService } from '../../prisma/prisma.service';
import { daysSince } from '../report-date-utils';
import { ReportTemplate, ReportTableResult } from './types';

export function ticketsOpenByAssigneeTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'tickets_open_by_assignee',
    title: 'Otvoreni tiketi po korisniku',
    description: 'Broj tiketa u statusu OPEN ili IN_PROGRESS po dodeljenom korisniku.',
    paramsSchema: {},
    run: async (ctx): Promise<ReportTableResult> => {
      const grouped = await prisma.ticket.groupBy({
        by: ['assigneeId'],
        where: {
          tenantId: ctx.tenantId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
        _count: { id: true },
      });

      const assigneeIds = grouped
        .map((g) => g.assigneeId)
        .filter((id): id is string => typeof id === 'string');
      const users = assigneeIds.length
        ? await prisma.user.findMany({
            where: { tenantId: ctx.tenantId, id: { in: assigneeIds } },
            select: { id: true, email: true, displayName: true },
          })
        : [];
      const userById = new Map(users.map((u) => [u.id, u]));

      const rows = grouped
        .map((g) => {
          const u = g.assigneeId ? userById.get(g.assigneeId) : undefined;
          return {
            assigneeName: u?.displayName?.trim() || u?.email || '(nije dodeljeno)',
            assigneeEmail: u?.email ?? '',
            openCount: g._count.id,
          };
        })
        .sort((a, b) => b.openCount - a.openCount);

      const total = rows.reduce((s, r) => s + r.openCount, 0);

      return {
        title: 'Otvoreni tiketi po korisniku podrške',
        columns: [
          { key: 'assigneeName', label: 'Korisnik' },
          { key: 'assigneeEmail', label: 'Email' },
          { key: 'openCount', label: 'Broj tiketa' },
        ],
        rows: [
          { assigneeName: '__UKUPNO__', assigneeEmail: '', openCount: total },
          ...rows,
        ],
        meta: { rowCount: rows.length },
      };
    },
  };
}

export function ticketsStaleOpenTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'tickets_stale_open',
    title: 'Zastareli OPEN tiketi',
    description: 'Tiketi u statusu OPEN stariji od N dana, sa kompanijom.',
    paramsSchema: { days: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const days = Math.max(1, Number(params.days ?? 14));
      const cutoff = daysSince(ctx.now, days);

      const tickets = await prisma.ticket.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: 'OPEN',
          createdAt: { lt: cutoff },
        },
        select: {
          key: true,
          title: true,
          createdAt: true,
          company: { select: { name: true } },
          assignee: { select: { email: true, displayName: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 5000,
      });

      const rows = tickets.map((t) => ({
        ticketKey: t.key,
        title: t.title,
        companyName: t.company?.name ?? '',
        assigneeName: t.assignee?.displayName?.trim() || t.assignee?.email || '',
        createdAt: t.createdAt.toISOString().slice(0, 10),
        daysOpen: Math.floor((ctx.now.getTime() - t.createdAt.getTime()) / 86400000),
      }));

      return {
        title: `OPEN tiketi stariji od ${days} dana`,
        columns: [
          { key: 'ticketKey', label: 'Tiket' },
          { key: 'title', label: 'Naslov' },
          { key: 'companyName', label: 'Kompanija' },
          { key: 'assigneeName', label: 'Dodeljen' },
          { key: 'createdAt', label: 'Kreiran' },
          { key: 'daysOpen', label: 'Dana otvoren' },
        ],
        rows,
        meta: { days, rowCount: rows.length },
      };
    },
  };
}

export function ticketsByTypeInPeriodTemplate(prisma: PrismaService): ReportTemplate {
  return {
    key: 'tickets_by_type_in_period',
    title: 'Tiketi po tipu u periodu',
    description: 'Broj kreiranih tiketa po tipu u poslednjih N dana.',
    paramsSchema: { days: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const days = Math.max(1, Number(params.days ?? 30));
      const since = daysSince(ctx.now, days);

      const grouped = await prisma.ticket.groupBy({
        by: ['type'],
        where: { tenantId: ctx.tenantId, createdAt: { gte: since } },
        _count: { id: true },
      });

      const typeLabels: Record<string, string> = {
        CALL: 'Poziv',
        SUPPORT: 'Podrška',
        SALES: 'Prodaja',
        FIELD: 'Teren',
        OTHER: 'Ostalo',
      };

      const rows = grouped
        .map((g) => ({
          type: g.type,
          typeLabel: typeLabels[g.type] ?? g.type,
          count: g._count.id,
        }))
        .sort((a, b) => b.count - a.count);

      const total = rows.reduce((s, r) => s + r.count, 0);

      return {
        title: `Tiketi po tipu (poslednjih ${days} dana)`,
        columns: [
          { key: 'typeLabel', label: 'Tip' },
          { key: 'type', label: 'Kod' },
          { key: 'count', label: 'Broj' },
        ],
        rows: [{ typeLabel: '__UKUPNO__', type: '', count: total }, ...rows],
        meta: { days, rowCount: rows.length },
      };
    },
  };
}
