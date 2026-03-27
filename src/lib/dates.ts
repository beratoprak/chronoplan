import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  isSameMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  parseISO,
} from "date-fns";
import { tr } from "date-fns/locale";

export const DATE_FORMAT = "yyyy-MM-dd";

export function formatDate(date: Date | string, pattern: string = DATE_FORMAT): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern, { locale: tr });
}

export function getMonthDays(date: Date): Date[] {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

export function isTodayDate(date: Date): boolean {
  return isToday(date);
}

export function isSameMonthDate(date: Date, referenceDate: Date): boolean {
  return isSameMonth(date, referenceDate);
}

export function nextMonth(date: Date): Date {
  return addMonths(date, 1);
}

export function prevMonth(date: Date): Date {
  return subMonths(date, 1);
}

export function nextWeek(date: Date): Date {
  return addWeeks(date, 1);
}

export function prevWeek(date: Date): Date {
  return subWeeks(date, 1);
}

export const WEEKDAY_LABELS_SHORT = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

export const MONTH_NAMES_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export const DAY_NAMES_TR = [
  "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar",
];

export function formatTimeRange(start?: string, end?: string): string {
  if (!start) return "";
  if (!end) return start;
  return `${start} — ${end}`;
}

export function minutesToDisplay(minutes?: number): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}s ${m}dk` : `${h}s`;
}
