import { PrismaService } from '../../prisma/prisma.service';
import { ReportTemplate, ReportTableResult } from './types';

type RowKey = string;

function norm(v?: string | null): string {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, '');
}

function makeKey(pib?: string | null, mb?: string | null, name?: string | null): RowKey {
  const p = norm(pib);
  const m = norm(mb);
  const n = String(name ?? '').trim();
  if (p) return `pib:${p}`;
  if (m) return `mb:${m}`;
  return `name:${n.toLowerCase()}`;
}

export function compareDistributorEmailsToCompaniesTemplate(
  prisma: PrismaService,
): ReportTemplate {
  return {
    key: 'compare_distributor_emails_to_companies',
    title: 'Poređenje: Mailovi distributerima → Kompanije (PIB/MB) + Users',
    description:
      'Za redove iz tabele \"Mailovi distributerima\" pronalazi Company po PIB/MB i vraća da li kompanija ima bar jednog korisnika.',
    paramsSchema: { limit: 'number' },
    run: async (ctx, params): Promise<ReportTableResult> => {
      const limit = Math.min(5000, Math.max(1, Number(params.limit ?? 2000)));

      const [sourceRows, companies] = await Promise.all([
        prisma.salesDistributorEmailRow.findMany({
          where: { tenantId: ctx.tenantId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            mb: true,
            pib: true,
            companyName: true,
            email: true,
            createdAt: true,
          },
        }),
        prisma.company.findMany({
          where: { tenantId: ctx.tenantId },
          select: { id: true, name: true, pib: true, mb: true },
          take: 10000,
        }),
      ]);

      const byPib = new Map<string, { id: string; name: string }>();
      const byMb = new Map<string, { id: string; name: string }>();
      for (const c of companies) {
        const p = norm(c.pib);
        const m = norm(c.mb);
        if (p && !byPib.has(p)) byPib.set(p, { id: c.id, name: c.name });
        if (m && !byMb.has(m)) byMb.set(m, { id: c.id, name: c.name });
      }

      // Keep only latest row per key to avoid duplicates.
      const latest = new Map<RowKey, (typeof sourceRows)[number]>();
      for (const r of sourceRows) {
        const k = makeKey(r.pib, r.mb, r.companyName);
        if (!latest.has(k)) latest.set(k, r);
      }

      const reduced = [...latest.values()];

      // Precompute users per company
      const companyIds = reduced
        .map((r) => {
          const p = norm(r.pib);
          const m = norm(r.mb);
          return p ? byPib.get(p)?.id : m ? byMb.get(m)?.id : undefined;
        })
        .filter((x): x is string => typeof x === 'string');

      const userCountsByCompany = new Map<string, number>();
      if (companyIds.length) {
        const grouped = await prisma.user.groupBy({
          by: ['companyId'],
          where: { tenantId: ctx.tenantId, companyId: { in: [...new Set(companyIds)] } },
          _count: { id: true },
        });
        grouped.forEach((g) => {
          if (g.companyId) userCountsByCompany.set(g.companyId, g._count.id);
        });
      }

      const rows = reduced.map((r) => {
        const p = norm(r.pib);
        const m = norm(r.mb);
        const match = p ? byPib.get(p) : m ? byMb.get(m) : undefined;
        const usersCount = match ? userCountsByCompany.get(match.id) ?? 0 : 0;
        return {
          mb: r.mb ?? '',
          pib: r.pib ?? '',
          sourceCompanyName: r.companyName ?? '',
          sourceEmail: r.email ?? '',
          matched: match ? 'DA' : 'NE',
          matchedCompanyName: match?.name ?? '',
          usersCount,
          hasUsers: usersCount > 0 ? 'DA' : 'NE',
        };
      });

      return {
        title: 'Poređenje: Mailovi distributerima → Company (PIB/MB) + Users',
        columns: [
          { key: 'mb', label: 'MB' },
          { key: 'pib', label: 'PIB' },
          { key: 'sourceCompanyName', label: 'Naziv (u tabeli)' },
          { key: 'sourceEmail', label: 'Email (u tabeli)' },
          { key: 'matched', label: 'Postoji kompanija' },
          { key: 'matchedCompanyName', label: 'Naziv kompanije (u sistemu)' },
          { key: 'usersCount', label: 'Broj korisnika' },
          { key: 'hasUsers', label: 'Ima korisnike (A)' },
        ],
        rows,
        meta: {
          inputRows: sourceRows.length,
          uniqueKeys: reduced.length,
          limit,
        },
      };
    },
  };
}

