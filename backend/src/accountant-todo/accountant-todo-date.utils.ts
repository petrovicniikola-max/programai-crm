const TZ = 'Europe/Belgrade';

export function belgradeTodayParts(now = new Date()): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return { year, month, day };
}

export function belgradeStartOfToday(now = new Date()): Date {
  const { year, month, day } = belgradeTodayParts(now);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function isSameBelgradeDay(a: Date, b: Date): boolean {
  const pa = belgradeTodayParts(a);
  const pb = belgradeTodayParts(b);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

export function isBeforeBelgradeDay(date: Date, ref = new Date()): boolean {
  const start = belgradeStartOfToday(ref).getTime();
  const d = belgradeStartOfToday(date).getTime();
  return d < start;
}

export function isDueTodayOrOverdue(dueDate: Date | null | undefined, now = new Date()): boolean {
  if (!dueDate) return false;
  const due = belgradeStartOfToday(dueDate).getTime();
  const today = belgradeStartOfToday(now).getTime();
  return due <= today;
}
