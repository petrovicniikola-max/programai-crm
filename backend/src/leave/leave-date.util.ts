export function parseDateOnly(input: string | Date): Date {
  if (input instanceof Date) {
    // Prisma @db.Date is stored/read as UTC midnight of the calendar date.
    return new Date(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate());
  }
  const s = input.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    return new Date(y, m - 1, d);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function formatDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cur = parseDateOnly(start);
  const last = parseDateOnly(end);
  while (cur <= last) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return days;
}

/** Fiscal year label: July Y – June Y+1 is labeled Y if month >= 7 else Y-1 */
export function fiscalYearLabel(d: Date, startMonth = 7): number {
  const y = d.getFullYear();
  return d.getMonth() + 1 >= startMonth ? y : y - 1;
}

export function fiscalYearExpiresAt(entitlementYear: number): Date {
  return new Date(entitlementYear + 1, 5, 30, 23, 59, 59, 999);
}

export function calendarYear(d: Date): number {
  return d.getFullYear();
}

export function formatDateDdMmYyyy(d: Date): string {
  const x = parseDateOnly(d);
  const day = String(x.getDate()).padStart(2, '0');
  const month = String(x.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${x.getFullYear()}`;
}
