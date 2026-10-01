import { Injectable } from '@nestjs/common';
import { LeaveType } from '@prisma/client';
import { eachDay, isWeekend, parseDateOnly } from './leave-date.util';

export interface DayBreakdown {
  date: string;
  days: number;
  isWeekend: boolean;
  isHoliday: boolean;
  countsTowardBalance: boolean;
}

export interface BreakdownResult {
  entries: DayBreakdown[];
  totalWorkingDays: number;
}

@Injectable()
export class WorkingDaysCalculator {
  buildBreakdown(
    startDate: Date,
    endDate: Date,
    type: LeaveType,
    holidayDates: Set<string>,
    dayOverrides?: Record<string, number>,
  ): BreakdownResult {
    const entries: DayBreakdown[] = [];
    let total = 0;

    for (const day of eachDay(startDate, endDate)) {
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      const weekend = isWeekend(day);
      const holiday = holidayDates.has(key);
      let days = 0;
      let counts = false;

      if (type === LeaveType.ANNUAL || type === LeaveType.PAID_ABSENCE) {
        if (!weekend && !holiday) {
          days = dayOverrides?.[key] ?? 1;
          counts = days > 0;
        }
      } else if (type === LeaveType.PERSONAL) {
        if (!weekend && !holiday) {
          days = dayOverrides?.[key] ?? 1;
          counts = days > 0;
        }
      }

      if (dayOverrides && key in dayOverrides) {
        days = dayOverrides[key];
        counts = days > 0 && !weekend && !holiday;
      }

      if (counts) total += days;

      entries.push({
        date: key,
        days,
        isWeekend: weekend,
        isHoliday: holiday,
        countsTowardBalance: counts,
      });
    }

    return { entries, totalWorkingDays: total };
  }

  firstWorkingDayAfter(endDate: Date, holidayDates: Set<string>): Date {
    let d = parseDateOnly(endDate);
    d.setDate(d.getDate() + 1);
    for (let i = 0; i < 14; i++) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!isWeekend(d) && !holidayDates.has(key)) return d;
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  maxConsecutiveCalendarDays(start: Date, end: Date): number {
    const days = eachDay(start, end);
    return days.length;
  }
}
