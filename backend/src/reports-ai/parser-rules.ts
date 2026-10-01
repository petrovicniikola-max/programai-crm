import { ParserContext } from './parser-context';
import { calendarDaysForReportHours, formatPeriodLabel } from './report-date-utils';

type ParsedRuleResult = {
  templateKey: string;
  params: Record<string, unknown>;
  title: string;
  confidence: number;
};

type ParserRule = {
  match: (c: ParserContext) => boolean;
  build: (c: ParserContext) => ParsedRuleResult;
};

function periodParams(c: ParserContext): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (c.year) params.year = c.year;
  if (c.month) params.month = c.month;
  return params;
}

function periodLabel(c: ParserContext): string {
  return formatPeriodLabel(c.year, c.month);
}

function quarterLabel(c: ParserContext): string {
  const q = c.quarter ?? Math.floor(new Date().getMonth() / 3) + 1;
  const y = c.year ?? new Date().getFullYear();
  return `Q${q} ${y}`;
}

export const PARSER_RULES: ParserRule[] = [
  // --- Evidencija rada (specifičnije prvo) ---
  {
    match: (c) =>
      c.mentionsWorkOrdersExport &&
      (c.mentionsProjects || c.mentionsTime) &&
      !c.email,
    build: (c) => ({
      templateKey: 'project_time_work_orders_export',
      params: {
        ...periodParams(c),
        ...(c.projectName ? { project: c.projectName } : {}),
      },
      title: c.projectName
        ? `Radni nalozi: ${c.projectName} (${periodLabel(c)})`
        : `Radni nalozi – evidencija rada (${periodLabel(c)})`,
      confidence: 0.93,
    }),
  },
  {
    match: (c) =>
      c.mentionsMissing &&
      (c.mentionsProjects || c.mentionsTime) &&
      !c.email,
    build: (c) => ({
      templateKey: 'project_time_missing_entries',
      params: periodParams(c),
      title: `Korisnici bez evidencije rada (${periodLabel(c)})`,
      confidence: 0.92,
    }),
  },
  {
    match: (c) =>
      c.mentionsProjects &&
      c.mentionsTime &&
      !!c.projectName &&
      c.mentionsPerUser &&
      !c.email &&
      (c.mentionsMonthly || c.month != null),
    build: (c) => ({
      templateKey: 'project_time_project_monthly_by_user',
      params: {
        project: c.projectName,
        ...periodParams(c),
      },
      title: `Sati po korisniku: ${c.projectName} (${periodLabel(c)})`,
      confidence: 0.9,
    }),
  },
  {
    match: (c) =>
      c.mentionsProjects &&
      c.mentionsTime &&
      !c.email &&
      (c.hoursThreshold != null || /prekorač|preko\s+\d+/i.test(c.lower)) &&
      (c.mentionsMonthly || c.month != null),
    build: (c) => ({
      templateKey: 'project_time_projects_over_hours',
      params: {
        hoursThreshold: c.hoursThreshold ?? 100,
        ...periodParams(c),
      },
      title: `Projekti preko ${c.hoursThreshold ?? 100} sati (${periodLabel(c)})`,
      confidence: 0.88,
    }),
  },
  {
    match: (c) =>
      c.mentionsProjects &&
      c.mentionsTime &&
      !c.email &&
      (c.mentionsQuarterly || c.quarter != null),
    build: (c) => ({
      templateKey: 'project_time_quarterly_by_user_and_project',
      params: {
        ...(c.year ? { year: c.year } : {}),
        ...(c.quarter ? { quarter: c.quarter } : {}),
      },
      title: `Evidencija rada po korisniku i projektu (${quarterLabel(c)})`,
      confidence: 0.9,
    }),
  },
  {
    match: (c) =>
      c.mentionsProjects &&
      c.mentionsTime &&
      !c.email &&
      (c.mentionsWeekly || c.days === 7),
    build: (c) => ({
      templateKey: 'project_time_weekly_by_user_and_project',
      params: { days: c.days ?? 7 },
      title: `Evidencija rada (poslednjih ${c.days ?? 7} dana)`,
      confidence: 0.88,
    }),
  },
  {
    match: (c) =>
      c.mentionsProjects &&
      c.mentionsTime &&
      !c.email &&
      (c.mentionsMonthly || c.mentionsAllUsers),
    build: (c) => ({
      templateKey: 'project_time_monthly_by_user_and_project',
      params: periodParams(c),
      title: `Evidencija rada po korisniku i projektu (${periodLabel(c)})`,
      confidence: 0.9,
    }),
  },
  {
    match: (c) => c.mentionsProjects && c.mentionsTime && !!c.email && !!c.projectName,
    build: (c) => ({
      templateKey: 'project_time_user_on_project',
      params: { email: c.email, project: c.projectName, days: c.days ?? 0 },
      title: `Utrošeno vreme: ${c.email} / ${c.projectName}`,
      confidence: 0.85,
    }),
  },
  {
    match: (c) => c.mentionsProjects && c.mentionsTime && !!c.email,
    build: (c) => ({
      templateKey: 'project_time_user_all_projects',
      params: { email: c.email, days: c.days ?? 0 },
      title: `Utrošeno vreme: ${c.email} (svi projekti)`,
      confidence: 0.8,
    }),
  },
  {
    match: (c) => c.mentionsProjects && c.mentionsTime,
    build: (c) => ({
      templateKey: 'project_time_per_project',
      params: { days: c.days ?? 0 },
      title: 'Utrošeno vreme po projektu',
      confidence: 0.75,
    }),
  },

  // --- Tiketi ---
  {
    match: (c) =>
      c.mentionsTickets &&
      c.mentionsOpen &&
      (c.mentionsStale || (c.days != null && c.days > 0)),
    build: (c) => ({
      templateKey: 'tickets_stale_open',
      params: { days: c.days ?? 14 },
      title: `OPEN tiketi stariji od ${c.days ?? 14} dana`,
      confidence: 0.88,
    }),
  },
  {
    match: (c) =>
      c.mentionsTickets &&
      c.mentionsOpen &&
      !/po tipu|tip\s*\(/i.test(c.lower),
    build: (c) => ({
      templateKey: 'tickets_open_by_assignee',
      params: {},
      title: 'Otvoreni tiketi po korisniku podrške',
      confidence: 0.85,
    }),
  },
  {
    match: (c) => c.mentionsTickets && (/po tipu|tip\s*\(/i.test(c.lower) || c.days != null),
    build: (c) => ({
      templateKey: 'tickets_by_type_in_period',
      params: { days: c.days ?? 30 },
      title: `Tiketi po tipu (poslednjih ${c.days ?? 30} dana)`,
      confidence: 0.85,
    }),
  },

  // --- Licence i uređaji (istekle pre specifičnijeg pravila za budući istek) ---
  {
    match: (c) =>
      c.mentionsLicences &&
      c.mentionsDistributor &&
      (c.mentionsLost ||
        (c.mentionsPastPeriod && /istekl|expired/i.test(c.lower))),
    build: (c) => {
      const days =
        c.days ??
        (c.hours != null ? calendarDaysForReportHours(c.hours) : 3);
      return {
        templateKey: 'lost_licences_by_distributor',
        params: {
          days,
          includeDetails: !/samo\s+broj|bez\s+detalj|samo\s+po\s+distributer/i.test(c.lower),
        },
        title: `Istekle licence po distributeru (poslednjih ${days} dana)`,
        confidence: 0.93,
      };
    },
  },
  {
    match: (c) =>
      c.mentionsLicences &&
      !c.mentionsLost &&
      !c.mentionsPastPeriod &&
      c.mentionsExpiringSoon,
    build: (c) => ({
      templateKey: 'licences_expiring_soon_by_company',
      params: { days: c.days ?? 30 },
      title: `Licence koje ističu u narednih ${c.days ?? 30} dana`,
      confidence: 0.88,
    }),
  },
  {
    match: (c) =>
      c.mentionsDevices &&
      c.mentionsLicences &&
      /bez\s+(aktivne\s+)?licenc/i.test(c.lower),
    build: (c) => ({
      templateKey: 'active_devices_without_licence',
      params: {},
      title: 'Aktivni uređaji bez aktivne licence',
      confidence: 0.88,
    }),
  },
  {
    match: (c) =>
      c.mentionsDevices &&
      (/novo\s+registr|novi\s+uređaj|novi\s+uredjaj|novo\s+dodat/i.test(c.lower) ||
        (c.days != null && c.mentionsDistributor)),
    build: (c) => ({
      templateKey: 'new_devices_by_distributor',
      params: { days: c.days ?? 30 },
      title: `Novi uređaji po distributeru (${c.days ?? 30} dana)`,
      confidence: 0.85,
    }),
  },

  // --- Prodaja ---
  {
    match: (c) =>
      (c.mentionsSales || /import\s+redov/i.test(c.lower)) &&
      (/bez\s+povezan|bez\s+match|bez\s+kompanij/i.test(c.lower) || c.mentionsCompare),
    build: (c) => ({
      templateKey: 'sales_directory_without_company_match',
      params: { days: c.days ?? 30, limit: 2000 },
      title: `Sales import bez kompanije (${c.days ?? 30} dana)`,
      confidence: 0.85,
    }),
  },
  {
    match: (c) =>
      (c.mentionsSales || c.mentionsNoEmail) &&
      (/bez\s+email|nema\s+email|without\s+email/i.test(c.lower) || c.mentionsNoEmail),
    build: (c) => ({
      templateKey: 'sales_directory_without_email',
      params: { limit: 2000 },
      title: 'Sales direktorijum – kompanije bez emaila',
      confidence: 0.85,
    }),
  },
  {
    match: (c) => c.mentionsSalesDistTable && (c.mentionsCompare || c.mentionsPibMb),
    build: (c) => ({
      templateKey: 'compare_distributor_emails_to_companies',
      params: { limit: 2000 },
      title: 'Poređenje: Mailovi distributerima → Company (PIB/MB) + Users',
      confidence: 0.8,
    }),
  },

  // --- Odsustva ---
  {
    match: (c) =>
      c.mentionsLeave &&
      (/odobren|approved/i.test(c.lower) || c.year != null || c.month != null),
    build: (c) => ({
      templateKey: 'leave_approved_in_month',
      params: periodParams(c),
      title: `Odobrena odsustva – ${periodLabel(c)}`,
      confidence: 0.88,
    }),
  },
  {
    match: (c) =>
      c.mentionsLeave &&
      (/godišnj|godisnj|annual|preostal|ispod/i.test(c.lower) || c.limit != null),
    build: (c) => {
      const minDays =
        c.limit ??
        (() => {
          const m = c.lower.match(/ispod\s+(\d{1,2})\s*dan/i);
          return m ? Number(m[1]) : 5;
        })();
      return {
        templateKey: 'leave_low_annual_balance',
        params: { minDays, ...(c.year ? { year: c.year } : {}) },
        title: `Godišnji odmor ispod ${minDays} dana`,
        confidence: 0.85,
      };
    },
  },

  // --- Kompanije ---
  {
    match: (c) =>
      c.mentionsCompanies &&
      c.mentionsTickets &&
      (/bez\s+tiket/i.test(c.lower) || c.days != null),
    build: (c) => ({
      templateKey: 'companies_no_tickets_in_days',
      params: { days: c.days ?? 90 },
      title: `Kompanije bez tiketa (${c.days ?? 90} dana)`,
      confidence: 0.85,
    }),
  },
  {
    match: (c) =>
      c.mentionsCompanies &&
      c.mentionsDevices &&
      (c.mentionsTop || c.limit != null),
    build: (c) => ({
      templateKey: 'top_companies_by_active_devices',
      params: { limit: c.limit ?? 20 },
      title: `Top ${c.limit ?? 20} kompanija po aktivnim uređajima`,
      confidence: 0.85,
    }),
  },

  // --- Postojeći licence/korisnici ---
  {
    match: (c) => c.mentionsLicences && c.mentionsActive && !c.mentionsDistributor,
    build: (c) => ({
      templateKey: 'active_licences_last_days',
      params: { days: c.days ?? 30 },
      title: `Aktivne licence (${c.days ?? 30} dana)`,
      confidence: 0.85,
    }),
  },
  {
    match: (c) =>
      c.mentionsLicences &&
      c.mentionsDistributor &&
      !c.mentionsLost &&
      (c.mentionsActive || c.mentionsTop),
    build: (c) => ({
      templateKey: 'top_distributors_active_licences',
      params: { days: c.days ?? 30, limit: 10 },
      title: `Distributeri: aktivne licence (${c.days ?? 30} dana)`,
      confidence: 0.85,
    }),
  },
  {
    match: (c) => c.mentionsUsers && c.mentionsActive,
    build: (c) => ({
      templateKey: 'active_users_last_days',
      params: { days: c.days ?? 60 },
      title: `Aktivni korisnici (${c.days ?? 60} dana)`,
      confidence: 0.8,
    }),
  },
];

export function matchParserRule(c: ParserContext): ParsedRuleResult | null {
  for (const rule of PARSER_RULES) {
    if (rule.match(c)) return rule.build(c);
  }
  return null;
}
