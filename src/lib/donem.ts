import { addDays, addMonths, addWeeks, endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import { useAppStore } from "@/lib/store";
import { DATE_FORMAT, MONTH_NAMES_TR } from "@/lib/dates";
import type { ViewType } from "@/types";

/** Gün/Hafta/Ay görünümleri: ok ve kaydırma ile dönem değiştirilebilenler. */
export const TAKVIM_GORUNUMLERI: ViewType[] = ["daily", "weekly", "monthly"];

/** Seçili günü görünümün dönemi kadar ileri/geri al (Topbar okları ve telefonda kaydırma). */
export function donemKaydir(yon: -1 | 1): void {
  const { selectedDate, currentView, setSelectedDate } = useAppStore.getState();
  const tarih = parseISO(selectedDate);
  const yeni =
    currentView === "monthly" ? addMonths(tarih, yon) : currentView === "weekly" ? addWeeks(tarih, yon) : addDays(tarih, yon);
  setSelectedDate(format(yeni, DATE_FORMAT));
}

/** Telefondaki üst çubuk için kısa dönem etiketi: "19 Kasım", "16–22 Kas", "Kasım 2026". */
export function kisaDonemEtiketi(selectedDate: string, view: ViewType): string {
  const t = parseISO(selectedDate);
  const ay = (d: Date) => MONTH_NAMES_TR[d.getMonth()];
  if (view === "monthly") return `${ay(t)} ${t.getFullYear()}`;
  if (view === "weekly") {
    const bas = startOfWeek(t, { weekStartsOn: 1 });
    const son = endOfWeek(t, { weekStartsOn: 1 });
    return bas.getMonth() === son.getMonth()
      ? `${bas.getDate()}–${son.getDate()} ${ay(son).slice(0, 3)}`
      : `${bas.getDate()} ${ay(bas).slice(0, 3)} – ${son.getDate()} ${ay(son).slice(0, 3)}`;
  }
  return `${t.getDate()} ${ay(t)}`;
}
