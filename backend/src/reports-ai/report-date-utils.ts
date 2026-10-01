export const MONTH_LABELS = [
  'januar',
  'februar',
  'mart',
  'april',
  'maj',
  'jun',
  'jul',
  'avgust',
  'septembar',
  'oktobar',
  'novembar',
  'decembar',
];

const MONTH_NAME_TO_NUM: Record<string, number> = {
  januar: 1,
  januara: 1,
  januaru: 1,
  january: 1,
  jan: 1,
  februar: 2,
  februara: 2,
  februaru: 2,
  february: 2,
  feb: 2,
  mart: 3,
  marta: 3,
  martu: 3,
  march: 3,
  mar: 3,
  april: 4,
  aprila: 4,
  aprilu: 4,
  apr: 4,
  maj: 5,
  maja: 5,
  maju: 5,
  may: 5,
  jun: 6,
  juna: 6,
  junu: 6,
  june: 6,
  jul: 7,
  jula: 7,
  julu: 7,
  july: 7,
  avgust: 8,
  avgusta: 8,
  avgustu: 8,
  august: 8,
  augusta: 8,
  augustu: 8,
  sep: 9,
  septembar: 9,
  septembra: 9,
  septembru: 9,
  september: 9,
  oktobar: 10,
  oktobra: 10,
  oktobru: 10,
  october: 10,
  oct: 10,
  novembar: 11,
  novembra: 11,
  novembru: 11,
  november: 11,
  nov: 11,
  decembar: 12,
  decembra: 12,
  decembru: 12,
  december: 12,
  dec: 12,
};

const MONTH_NAME_KEYS = Object.keys(MONTH_NAME_TO_NUM).sort((a, b) => b.length - a.length);

export function extractYearMonth(text: string): { year?: number; month?: number } {
  const lower = text.toLowerCase();

  const iso = text.match(/\b(20\d{2})-(\d{1,2})\b/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]) };

  const ymd = text.match(/\b(20\d{2})[./](\d{1,2})\b/);
  if (ymd) return { year: Number(ymd[1]), month: Number(ymd[2]) };

  const dmy = text.match(/\b(\d{1,2})[./](20\d{2})\b/);
  if (dmy) return { year: Number(dmy[2]), month: Number(dmy[1]) };

  let month: number | undefined;
  for (const name of MONTH_NAME_KEYS) {
    if (lower.includes(name)) {
      month = MONTH_NAME_TO_NUM[name];
      break;
    }
  }

  const yearM = text.match(/\b(20\d{2})\b/);
  const year = yearM ? Number(yearM[1]) : undefined;

  return { year, month };
}

export function extractQuarter(text: string): { year?: number; quarter?: number } {
  const lower = text.toLowerCase();
  const qMatch =
    lower.match(/\bq\s*([1-4])\b/i) ??
    lower.match(/\b([1-4])\s*\.\s*kvartal/i) ??
    lower.match(/kvartal\s*([1-4])/i);
  const quarter = qMatch ? Number(qMatch[1]) : undefined;
  const yearM = text.match(/\b(20\d{2})\b/);
  return { year: yearM ? Number(yearM[1]) : undefined, quarter };
}

export type PeriodParams = {
  year?: number | null;
  month?: number | null;
};

export type ResolvedPeriod = {
  from: Date;
  to: Date;
  label: string;
  year: number;
  month?: number;
  kind: 'month' | 'year';
};

function monthBounds(year: number, month: number): { from: Date; to: Date; label: string } {
  const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  return { from, to, label: `${MONTH_LABELS[month - 1]} ${year}` };
}

/** Godina + mesec iz params-a određuju opseg: samo godina = cela godina, godina+mesec = taj mesec. */
export function resolvePeriod(now: Date, params: PeriodParams): ResolvedPeriod {
  const hasYear = params.year != null && Number.isFinite(Number(params.year));
  const hasMonth = params.month != null && Number.isFinite(Number(params.month));
  const year = hasYear ? Number(params.year) : now.getFullYear();

  if (hasMonth) {
    const month = Math.min(12, Math.max(1, Number(params.month)));
    const bounds = monthBounds(year, month);
    return { ...bounds, year, month, kind: 'month' };
  }

  if (hasYear) {
    return {
      from: new Date(year, 0, 1, 0, 0, 0, 0),
      to: new Date(year, 11, 31, 23, 59, 59, 999),
      label: String(year),
      year,
      kind: 'year',
    };
  }

  const month = now.getMonth() + 1;
  const bounds = monthBounds(year, month);
  return { ...bounds, year, month, kind: 'month' };
}

export function formatPeriodLabel(year?: number, month?: number): string {
  if (year && month) return `${MONTH_LABELS[month - 1]} ${year}`;
  if (year) return String(year);
  if (month) return MONTH_LABELS[month - 1];
  return 'tekući mesec';
}

/** @deprecated Koristi resolvePeriod */
export function monthRange(
  now: Date,
  year?: number,
  month?: number,
): { from: Date; to: Date; label: string; year: number; month: number } {
  const period = resolvePeriod(now, {
    year: year ?? null,
    month: month ?? null,
  });
  return {
    from: period.from,
    to: period.to,
    label: period.label,
    year: period.year,
    month: period.month ?? now.getMonth() + 1,
  };
}

export function quarterRange(
  now: Date,
  year?: number,
  quarter?: number,
): { from: Date; to: Date; label: string; year: number; quarter: number } {
  const y = year ?? now.getFullYear();
  const q = quarter ?? Math.floor(now.getMonth() / 3) + 1;
  const startMonth = (q - 1) * 3;
  const from = new Date(y, startMonth, 1, 0, 0, 0, 0);
  const to = new Date(y, startMonth + 3, 0, 23, 59, 59, 999);
  return { from, to, label: `Q${q} ${y}`, year: y, quarter: q };
}

export function daysSince(now: Date, days: number): Date {
  const since = new Date(now);
  since.setDate(since.getDate() - Math.max(1, days));
  since.setHours(0, 0, 0, 0);
  return since;
}

export function hoursSince(now: Date, hours: number): Date {
  const since = new Date(now);
  since.setTime(since.getTime() - Math.max(1, hours) * 60 * 60 * 1000);
  return since;
}

/** Koliko kalendarskih dana validTo uključiti za zadati broj sati (48h → 3 dana uklj. danas). */
export function calendarDaysForReportHours(hours: number): number {
  if (hours <= 24) return 2;
  if (hours <= 48) return 3;
  return Math.max(1, Math.ceil(hours / 24));
}

/** Opseg datuma isteka licence (validTo) unazad N kalendarskih dana (uključujući danas). */
export function expiredInLastDays(
  now: Date,
  days: number,
): { from: Date; to: Date; calendarDays: number } {
  const calendarDays = Math.max(1, days);
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (calendarDays - 1));
  return { from, to, calendarDays };
}

/** @deprecated Koristi expiredInLastDays */
export function expiryCalendarRange(
  now: Date,
  hours: number,
): { from: Date; to: Date; calendarDays: number } {
  return expiredInLastDays(now, calendarDaysForReportHours(hours));
}

export function supportsPeriodParams(params: Record<string, unknown> | null | undefined): boolean {
  if (!params || typeof params !== 'object') return false;
  return 'year' in params || 'month' in params;
}
