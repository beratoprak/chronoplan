// ============================================================
// Epoche — Takvim/Planlama Saf Mantığı
// Bileşenlerden bağımsız, birim testine tabi fonksiyonlar.
// ============================================================

import { parseISO, addDays, addWeeks, addMonths, isBefore, isEqual, format, differenceInCalendarDays } from "date-fns";
import type { CalendarEvent, Task, ChecklistItem } from "@/types";

export const DATE_FORMAT = "yyyy-MM-dd";

/** Eski `date` alanını kaybetmeden görevin son teslim tarihini okur. */
export function getTaskDueDate(task: Task): string | undefined {
  return task.dueDate ?? task.date;
}

/**
 * Eski görevler yalnızca `date` taşıdığı için bu alan takvim günü olarak da
 * okunur. Yeni görevlerde planlanan gün açıkça `scheduledDate` ile tutulur.
 */
export function getTaskScheduledDate(task: Task): string | undefined {
  return task.scheduledDate ?? task.date;
}

export function timeToMinutes(time?: string): number | null {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(total)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function taskEndTime(task: Task, fallbackMinutes = 30): string | undefined {
  if (task.scheduledEndTime) return task.scheduledEndTime;
  const start = timeToMinutes(task.scheduledStartTime);
  if (start === null) return undefined;
  return minutesToTime(start + (task.estimatedMinutes ?? fallbackMinutes));
}

// ── Tekrarlı etkinlik açılımı ─────────────────────────────────
// [startDate, endDate] aralığındaki tüm etkinlik oluşumlarını döndürür.
// Tekrarlı etkinliklerin her oluşumu `id-YYYY-MM-DD` kimliği alır.
export function expandEvents(
  events: CalendarEvent[],
  startDate: string,
  endDate: string
): CalendarEvent[] {
  const result: CalendarEvent[] = [];
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  for (const event of events) {
    if (event.recurrence === "none" || !event.recurrence) {
      if (event.date >= startDate && event.date <= endDate) {
        result.push(event);
      }
      continue;
    }

    const eventStart = parseISO(event.date);
    const recEnd = event.recurrenceEndDate ? parseISO(event.recurrenceEndDate) : end;
    const effectiveEnd = isBefore(recEnd, end) ? recEnd : end;
    let current = eventStart;

    // Aralık başlangıcına kadar ilerle
    while (isBefore(current, start) && (isBefore(current, effectiveEnd) || isEqual(current, effectiveEnd))) {
      current = stepRecurrence(current, event.recurrence);
    }

    let safety = 0;
    while ((isBefore(current, effectiveEnd) || isEqual(current, effectiveEnd)) && safety < 366) {
      const dateStr = format(current, DATE_FORMAT);
      if (dateStr >= startDate) {
        result.push({ ...event, id: `${event.id}-${dateStr}`, date: dateStr });
      }
      current = stepRecurrence(current, event.recurrence);
      safety++;
    }
  }
  return result;
}

function stepRecurrence(current: Date, recurrence: CalendarEvent["recurrence"]): Date {
  if (recurrence === "daily") return addDays(current, 1);
  if (recurrence === "weekly") return addWeeks(current, 1);
  return addMonths(current, 1);
}

// ── Haftalık görünüm yardımcıları ─────────────────────────────

/** "09:30" → 9. Geçersiz/boş → null. */
export function slotHourOf(startTime?: string): number | null {
  if (!startTime) return null;
  const h = parseInt(startTime.slice(0, 2), 10);
  return Number.isNaN(h) || h < 0 || h > 23 ? null : h;
}

/** Tüm gün ya da saati olmayan etkinlik mi? (Saat ızgarasına oturmaz) */
export function isAllDayOrTimeless(event: CalendarEvent): boolean {
  return event.isAllDay || slotHourOf(event.startTime) === null;
}

/**
 * Haftanın saat satırları: taban 08–18; etkinlikler bu aralığın
 * dışına taşıyorsa aralık otomatik genişler — hiçbir etkinlik kaybolmaz.
 */
export function buildWeekHours(events: CalendarEvent[], baseStart = 8, baseEnd = 18): string[] {
  let min = baseStart;
  let max = baseEnd;
  for (const e of events) {
    const h = slotHourOf(e.startTime);
    if (h === null || e.isAllDay) continue;
    if (h < min) min = h;
    if (h > max) max = h;
  }
  const hours: string[] = [];
  for (let h = min; h <= max; h++) {
    hours.push(`${String(h).padStart(2, "0")}:00`);
  }
  return hours;
}

/** Belirli günde belirli saat satırına düşen etkinlikler (başlangıç saatine göre sıralı). */
export function eventsInSlot(dayEvents: CalendarEvent[], hour: string): CalendarEvent[] {
  const slotH = parseInt(hour.slice(0, 2), 10);
  return dayEvents
    .filter((e) => !isAllDayOrTimeless(e) && slotHourOf(e.startTime) === slotH)
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}

// ── Görev pencereleri ─────────────────────────────────────────

/**
 * Yaklaşan görevler: fromDate'ten SONRAKİ `days` gün içinde olanlar.
 * Uzak gelecekteki görevler artık "yaklaşan" sayılmaz.
 */
export function getUpcomingTasks(
  tasks: Task[],
  fromDate: string,
  days = 7,
  limit = 5
): Task[] {
  const windowEnd = format(addDays(parseISO(fromDate), days), DATE_FORMAT);
  return tasks
    .filter((t) => {
      const date = getTaskDueDate(t);
      return date && date > fromDate && date <= windowEnd && t.status !== "done";
    })
    .sort((a, b) => (getTaskDueDate(a) ?? "").localeCompare(getTaskDueDate(b) ?? ""))
    .slice(0, limit);
}

/** Belirli günün tamamlanmamış görevleri. */
export function getTasksForDate(tasks: Task[], date: string): Task[] {
  return tasks
    .filter((t) => taskOccursOnDate(t, date) && t.status !== "done")
    .sort((a, b) => a.order - b.order);
}

/** Planlanan görevin tekrar kuralına göre hedef günde görünmesi gerekir mi? */
export function taskOccursOnDate(task: Task, date: string): boolean {
  const base = getTaskScheduledDate(task);
  if (!base || date < base) return false;
  const recurrence = task.recurrence ?? "none";
  if (recurrence === "none") return base === date;
  const baseDate = parseISO(base);
  const targetDate = parseISO(date);
  const dayDiff = differenceInCalendarDays(targetDate, baseDate);
  if (recurrence === "daily") return true;
  if (recurrence === "weekly") return dayDiff % 7 === 0;
  return baseDate.getDate() === targetDate.getDate();
}

// ── Checklist birleştirme ──────────────────────────────────────
// Görevin geri kalanı LWW (kim daha yeni) ile seçilir, ama checklist
// maddeleri asla "kaybolmaz": iki cihazda da eklenen maddeler id'ye
// göre birleştirilir. Aynı id'de tamamlanma çakışırsa "tamamlandı"
// kazanır (bir işareti geri almak, işareti kaybetmekten daha güvenli).
export function mergeChecklists(a: ChecklistItem[], b: ChecklistItem[]): ChecklistItem[] {
  const map = new Map<string, ChecklistItem>();
  for (const item of a) map.set(item.id, item);
  for (const item of b) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else if (item.completed && !existing.completed) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

// ── Senkronizasyon birleştirme (LWW + tombstone) ──────────────

export interface Syncable {
  id: string;
  updatedAt?: string;
}

export interface MergeResult<T extends Syncable> {
  merged: T[];
  toPush: T[]; // yerel daha yeni → sunucuya gönder
  toSoftDelete: { entity: T; deletedAt: string }[]; // sunucuda hâlâ canlı → sil işaretle
  tombstonesOut: Record<string, string>; // bu tablo için güncel tombstone'lar
}

export function mergeEntities<T extends Syncable>(
  local: T[],
  remote: T[],
  remoteDeleted: Record<string, string>,
  tombstones: Record<string, string>,
  prefix: string
): MergeResult<T> {
  const localMap = new Map(local.map((i) => [i.id, i]));
  const remoteMap = new Map(remote.map((i) => [i.id, i]));
  const result: MergeResult<T> = { merged: [], toPush: [], toSoftDelete: [], tombstonesOut: {} };

  const localTombs: Record<string, string> = {};
  for (const [key, ts] of Object.entries(tombstones)) {
    if (key.startsWith(`${prefix}:`)) localTombs[key.slice(prefix.length + 1)] = ts;
  }

  const allIds = new Set([
    ...Array.from(localMap.keys()),
    ...Array.from(remoteMap.keys()),
    ...Object.keys(remoteDeleted),
    ...Object.keys(localTombs),
  ]);

  allIds.forEach((id) => {
    const loc = localMap.get(id);
    const rem = remoteMap.get(id);
    const remDel = remoteDeleted[id];
    const tomb = localTombs[id];

    if (tomb) {
      // Yerelde silinmiş. Silme anından SONRA başka cihazda düzenlendiyse geri getir.
      if (rem && (rem.updatedAt ?? "") > tomb) {
        result.merged.push(rem);
      } else {
        result.tombstonesOut[id] = tomb;
        if (rem) result.toSoftDelete.push({ entity: rem, deletedAt: tomb });
      }
      return;
    }
    if (remDel) {
      // Sunucuda silinmiş. Silme anından SONRA yerelde düzenlendiyse geri getir.
      if (loc && (loc.updatedAt ?? "") > remDel) {
        result.merged.push(loc);
        result.toPush.push(loc);
      } else {
        result.tombstonesOut[id] = remDel;
      }
      return;
    }
    if (loc && rem) {
      if ((loc.updatedAt ?? "") >= (rem.updatedAt ?? "")) {
        result.merged.push(loc);
        if ((loc.updatedAt ?? "") > (rem.updatedAt ?? "")) result.toPush.push(loc);
      } else {
        result.merged.push(rem);
      }
    } else if (loc) {
      result.merged.push(loc);
      result.toPush.push(loc);
    } else if (rem) {
      result.merged.push(rem);
    }
  });

  return result;
}

/** 90 günden eski tombstone'ları temizle (sonsuz büyümesin). */
export function pruneTombstones(tombstones: Record<string, string>): Record<string, string> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const pruned: Record<string, string> = {};
  for (const [key, ts] of Object.entries(tombstones)) {
    if (ts > cutoff) pruned[key] = ts;
  }
  return pruned;
}
