"use client";

import { useRef } from "react";
import { useAppStore } from "@/lib/store";
import { donemKaydir, TAKVIM_GORUNUMLERI } from "@/lib/donem";
import { DailyView } from "./DailyView";
import { WeeklyView } from "./WeeklyView";
import { MonthlyView } from "./MonthlyView";
import { KanbanView } from "./KanbanView";
import { NotesView } from "./NotesView";
import { MediaView } from "./MediaView";
import { PomodoroView } from "./PomodoroView";
import { SchoolView } from "./SchoolView";
import { OkulNotlariView } from "./OkulNotlariView";
import { SallananFigurler } from "@/components/shared/SallananFigurler";

/** Telefonda yatay kaydırmayla önceki/sonraki gün, hafta, ay. */
function useDonemKaydirma(etkin: boolean) {
  const bas = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const hedef = e.target as HTMLElement;
    // Not editörü, yana kayan alanlar ve form öğeleri kendi hareketini kullanır.
    if (!etkin || e.touches.length !== 1 || hedef.closest('[contenteditable="true"], input, textarea, select, [data-yatay-kaydir]')) {
      bas.current = null;
      return;
    }
    bas.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const b = bas.current;
    bas.current = null;
    if (!b || window.innerWidth >= 768) return;
    const dx = e.changedTouches[0].clientX - b.x;
    const dy = e.changedTouches[0].clientY - b.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8 && Date.now() - b.t < 600) donemKaydir(dx < 0 ? 1 : -1);
  };
  return { onTouchStart, onTouchEnd };
}

export function ViewSwitcher() {
  const { currentView } = useAppStore();
  const kaydirma = useDonemKaydirma(TAKVIM_GORUNUMLERI.includes(currentView));

  return (
    <div className="flex-1 p-3 pb-24 sm:p-5 md:pb-5 overflow-y-auto overflow-x-hidden" {...kaydirma}>
      {/* overflow-x-hidden: dikey kaydırma kabı taşan bir öğeyle telefonda yana da
          kayıyordu (haftalık görünümde kartların başı kesiliyordu). */}
      {/* Takvim görünümlerinin köşesinde sallanan figürler (Ayarlar → Figürlerim). */}
      {(currentView === "daily" || currentView === "weekly" || currentView === "monthly") && <SallananFigurler />}
      {currentView === "daily" && <DailyView />}
      {currentView === "weekly" && <WeeklyView />}
      {/* Telefonda figürler ayın gün başlıklarını (Pt…Pz) örtüyordu: altlarına yer aç. */}
      {currentView === "monthly" && <div className="max-md:pt-12"><MonthlyView /></div>}
      {currentView === "kanban" && <KanbanView />}
      {currentView === "notes" && <NotesView />}
      {currentView === "media" && <MediaView />}
      {currentView === "pomodoro" && <PomodoroView />}
      {currentView === "school" && <SchoolView />}
      {currentView === "okul-notlari" && <OkulNotlariView />}
    </div>
  );
}
