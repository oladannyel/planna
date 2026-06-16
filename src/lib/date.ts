import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";

export interface DateRange {
  /** Inclusive start, ISO date string "YYYY-MM-DD". */
  start: string;
  /** Inclusive end, ISO date string "YYYY-MM-DD". */
  end: string;
}

const ISO_DATE = "yyyy-MM-dd";

/** Monday-anchored week range containing `date`. */
export function getWeekRange(date: Date): DateRange {
  return {
    start: format(startOfWeek(date, { weekStartsOn: 1 }), ISO_DATE),
    end: format(endOfWeek(date, { weekStartsOn: 1 }), ISO_DATE),
  };
}

/** Calendar-month range containing `date`. */
export function getMonthRange(date: Date): DateRange {
  return {
    start: format(startOfMonth(date), ISO_DATE),
    end: format(endOfMonth(date), ISO_DATE),
  };
}

/** Format a Date as an ISO date string "YYYY-MM-DD". */
export function toISODate(date: Date): string {
  return format(date, ISO_DATE);
}
