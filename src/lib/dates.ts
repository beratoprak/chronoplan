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

/**
 * Göreli zaman: "az önce", "5 dk önce", "3 saat önce", "dün 14:30", "5 Tem 14:30".
 * Uygulamanın "ne zaman ne eklendi" bilinci için.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = parseISO(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24 && now.getDate() === then.getDate()) return `${diffHours} saat önce`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    then.getDate() === yesterday.getDate() &&
    then.getMonth() === yesterday.getMonth() &&
    then.getFullYear() === yesterday.getFullYear()
  ) {
    return `dün ${format(then, "HH:mm")}`;
  }

  if (then.getFullYear() === now.getFullYear()) {
    return format(then, "d MMM HH:mm", { locale: tr });
  }
  return format(then, "d MMM yyyy", { locale: tr });
}

export function minutesToDisplay(minutes?: number): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}s ${m}dk` : `${h}s`;
}
