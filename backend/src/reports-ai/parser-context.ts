import { extractQuarter, extractYearMonth } from './report-date-utils';

export type ParserContext = {
  text: string;
  lower: string;
  days?: number;
  hours?: number;
  email?: string;
  projectName?: string;
  year?: number;
  month?: number;
  quarter?: number;
  limit?: number;
  hoursThreshold?: number;
  mentionsLicences: boolean;
  mentionsDistributor: boolean;
  mentionsLost: boolean;
  mentionsPastPeriod: boolean;
  mentionsExpiringSoon: boolean;
  mentionsUsers: boolean;
  mentionsActive: boolean;
  mentionsProjects: boolean;
  mentionsTime: boolean;
  mentionsMonthly: boolean;
  mentionsQuarterly: boolean;
  mentionsWeekly: boolean;
  mentionsAllUsers: boolean;
  mentionsPerUser: boolean;
  mentionsMissing: boolean;
  mentionsWorkOrdersExport: boolean;
  mentionsTickets: boolean;
  mentionsOpen: boolean;
  mentionsStale: boolean;
  mentionsDevices: boolean;
  mentionsSales: boolean;
  mentionsLeave: boolean;
  mentionsCompanies: boolean;
  mentionsCompare: boolean;
  mentionsPibMb: boolean;
  mentionsSalesDistTable: boolean;
  mentionsNoEmail: boolean;
  mentionsTop: boolean;
};

function extractDays(text: string): number | null {
  const m = text.match(/(\d{1,3})\s*(dan|dana)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function extractHours(text: string): number | null {
  const range = text.match(/(\d{1,3})\s*[-–]\s*(\d{1,3})\s*(sat|sata|sati)/i);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.max(a, b);
  }
  const m = text.match(/(\d{1,3})\s*(sat|sata|sati)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function extractEmail(text: string): string | null {
  const m = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

function extractProjectName(text: string): string | null {
  const m =
    text.match(/na\s+projektu\s+(.+?)(?:,|\.|za\s|$)/i) ??
    text.match(/projektu\s+(.+?)(?:,|\.|za\s|$)/i) ??
    text.match(/projekat\s+(.+?)(?:,|\.|za\s|$)/i);
  const name = m?.[1]?.trim();
  return name ? name.replace(/^["']|["']$/g, '').trim() : null;
}

function extractLimit(text: string): number | undefined {
  const m = text.match(/top\s*(\d{1,3})/i) ?? text.match(/(\d{1,3})\s*kompanij/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function extractHoursThreshold(text: string): number | undefined {
  const m =
    text.match(/vi[sš]e\s+od\s+(\d{1,4})\s*sat/i) ??
    text.match(/preko\s+(\d{1,4})\s*sat/i) ??
    text.match(/(\d{1,4})\s*sat/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

export function buildParserContext(promptText: string): ParserContext {
  const text = (promptText ?? '').trim();
  const lower = text.toLowerCase();
  const { year, month } = extractYearMonth(text);
  const { year: qYear, quarter } = extractQuarter(text);

  return {
    text,
    lower,
    days: extractDays(lower) ?? undefined,
    hours: extractHours(lower) ?? undefined,
    email: extractEmail(lower) ?? undefined,
    projectName: extractProjectName(text) ?? undefined,
    year: year ?? qYear,
    month,
    quarter,
    limit: extractLimit(text),
    hoursThreshold: extractHoursThreshold(text),
    mentionsLicences: /licenc/.test(lower),
    mentionsDistributor: /distribut/.test(lower),
    mentionsLost:
      /izgublj|izgubio|izgubila|gubitak\s+licenc|prestale\s+aktiv|više\s+nisu\s+aktiv|istekl/i.test(
        lower,
      ),
    mentionsPastPeriod: /poslednj|prethodn|prošl|prosl|unazad/i.test(lower),
    mentionsExpiringSoon: /naredn|uskoro|isti[cč]e|isti[cč]u/i.test(lower),
    mentionsUsers: /korisnik|user/.test(lower),
    mentionsActive: /aktivan|aktivno|active/.test(lower),
    mentionsProjects: /projekt|evidencij/.test(lower),
    mentionsTime: /utro[sš]eno|vreme|sat/i.test(lower),
    mentionsMonthly: /meseč|mesečni|mesec|po mesecu|monthly/i.test(lower),
    mentionsQuarterly: /kvartal|\bq\s*[1-4]\b/i.test(lower),
    mentionsWeekly: /nedelj|poslednjih\s*7\s*dan|weekly/i.test(lower),
    mentionsAllUsers:
      /svi korisnici|svakog korisnika|za svakog|po korisniku|korisnik.*projekt/i.test(lower),
    mentionsPerUser: /po korisniku|za svakog korisnika|po user/i.test(lower),
    mentionsMissing: /nisu uneli|nije uneo|bez evidencij|bez unosa|missing/i.test(lower),
    mentionsWorkOrdersExport:
      /radn(i|ih)\s+nalog|po\s+radn|excel.*evidenc|evidenc.*excel|partner.*tip|serijski\s+broj|zahtevani\s+radov/i.test(
        lower,
      ),
    mentionsTickets: /tiket|ticket|prijav/i.test(lower),
    mentionsOpen: /\botvoren|open\b/i.test(lower),
    mentionsStale: /starij|nere[sš]en|nerije[sš]en|older than/i.test(lower),
    mentionsDevices: /uređaj|uredjaj|device/i.test(lower),
    mentionsSales: /prodaj|sales|direktorijum/i.test(lower),
    mentionsLeave: /odmor|odsustv|leave/i.test(lower),
    mentionsCompanies: /kompanij|klijent|client/i.test(lower),
    mentionsCompare: /poredi|uporedi|poređenj|poredjen|compare|match/.test(lower),
    mentionsPibMb: /pib|mb/.test(lower),
    mentionsSalesDistTable:
      /mailovi.*distributer|mailovi.*distribut|poredi.*distributer/i.test(lower),
    mentionsNoEmail: /bez email|nema email|without email/i.test(lower),
    mentionsTop: /top\s*\d|najviše|najvise/i.test(lower),
  };
}
