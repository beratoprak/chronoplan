// ============================================================
// Epoche — Takvim/Planlama Saf Mantığı
// Bileşenlerden bağımsız, birim testine tabi fonksiyonlar.
// ============================================================

import { parseISO, addDays, addWeeks, addMonths, isBefore, isEqual, format } from "date-fns";
import type { CalendarEvent, Task } from "@/types";

export const DATE_FORMAT = "yyyy-MM-dd";

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
    .filter((t) => t.date && t.date > fromDate && t.date <= windowEnd && t.status !== "done")
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .slice(0, limit);
}

/** Belirli günün tamamlanmamış görevleri. */
export function getTasksForDate(tasks: Task[], date: string): Task[] {
  return tasks
    .filter((t) => t.date === date && t.status !== "done")
    .sort((a, b) => a.order - b.order);
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
