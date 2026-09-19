"use client";

import { useEffect, useState } from "react";
import { parseISO, format, addDays, addWeeks, addMonths } from "date-fns";
import { Menu, Plus, Search, CalendarPlus, LogOut, Loader2, Sun, Moon, Clock, CloudOff, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MONTH_NAMES_TR, DAY_NAMES_TR, DATE_FORMAT } from "@/lib/dates";
import type { ViewType } from "@/types";

/** Canlı saat — dakikada bir güncellenir. */
function LiveClock() {
  // İlk render'da null: sunucu ile istemci saati farklı olabileceğinden
  // hydration uyuşmazlığını önler; saat mount'tan sonra görünür.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    // Dakika sınırına hizala, sonra her dakika güncelle
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60_000);
    }, msToNextMinute);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  if (!now) return null;

  return (
    <span
      className="hidden sm:flex items-center gap-1 text-xs tabular-nums"
      style={{ color: "var(--text-tertiary)" }}
      title={format(now, "d MMMM yyyy HH:mm")}
    >
      <Clock size={12} />
      {format(now, "HH:mm")}
    </span>
  );
}

const VIEW_TABS: { id: ViewType; label: string }[] = [
  { id: "daily", label: "Gün" },
  { id: "weekly", label: "Hafta" },
  { id: "monthly", label: "Ay" },
];

export function Topbar() {
  const { selectedDate, setSelectedDate, currentView, setView, toggleSidebar, openTaskModal, openEventModal, openSearch, user, syncStatus, hasSyncedOnce, signOut, theme, setTheme, isDemoMode } = useAppStore();
  const date = parseISO(selectedDate);
  const dayOfWeek = DAY_NAMES_TR[(date.getDay() + 6) % 7]; // Monday-first
  const isSchoolView = currentView === "school";

  const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const moveDate = (direction: -1 | 1) => {
    const next = currentView === "monthly"
      ? addMonths(date, direction)
      : currentView === "weekly"
        ? addWeeks(date, direction)
        : addDays(date, direction);
    setSelectedDate(format(next, DATE_FORMAT));
  };

  return (
    <header
      className="flex items-center justify-between px-3 sm:px-5 shrink-0"
      style={{
        height: "var(--topbar-height)",
        borderBottom: "0.5px solid var(--border-default)",
        background: "var(--surface-raised)",
      }}
    >
      {/* Left: menu + date */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          className="cp-icon-button shrink-0"
          style={{ color: "var(--text-tertiary)" }}
          aria-label="Menüyü aç veya kapat"
        >
          <Menu size={18} />
        </button>
        {isSchoolView ? (
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Okul ajandası</span>
        ) : <div className="flex items-center gap-1 min-w-0">
          <button onClick={() => moveDate(-1)} className="cp-icon-button hidden sm:flex" aria-label="Önceki dönem"><ChevronLeft size={16} /></button>
          <button
            onClick={() => setSelectedDate(format(new Date(), DATE_FORMAT))}
            className="text-sm sm:text-base font-medium truncate text-left hover:opacity-75 transition-opacity"
            style={{ color: "var(--text-primary)" }}
            title="Bugüne dön"
          >
            {date.getDate()} {MONTH_NAMES_TR[date.getMonth()]} {date.getFullYear()}
          </button>
          <span className="text-xs sm:text-sm hidden sm:inline" style={{ color: "var(--text-tertiary)" }}>
            {dayOfWeek}
          </span>
          <LiveClock />
          <button onClick={() => moveDate(1)} className="cp-icon-button hidden sm:flex" aria-label="Sonraki dönem"><ChevronRight size={16} /></button>
        </div>}
      </div>

      {/* Center: view tabs — hidden on mobile */}
      {!isSchoolView && <div className="cp-view-tabs hidden md:flex" aria-label="Takvim görünümü">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={cn("cp-view-tab", currentView === tab.id && "active")}
          >
            {tab.label}
          </button>
        ))}
      </div>}

      {/* Right: actions */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Sync gostergesi — yalnızca İLK senkronizasyonda; arka plan
            senkronizasyonları sessizdir ("sürekli yükleniyor" hissi olmasın) */}
        {syncStatus === "syncing" && !hasSyncedOnce && (
          <Loader2
            size={15}
            className="animate-spin"
            style={{ color: "var(--text-muted)" }}
          />
        )}
        {/* Bulut hatası — kullanıcı senkron sorununu GÖRSÜN */}
        {syncStatus === "error" && (
          <CloudOff
            size={15}
            style={{ color: "var(--priority-urgent)" }}
            aria-label="Bulut eşitleme hatası — Ayarlar'dan Şimdi Eşitle deneyin"
          />
        )}
        {/* Dark mode toggle (Faz 7) */}
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="p-1.5 rounded-lg hover:bg-cream-200 transition-colors"
          style={{ color: "var(--text-tertiary)" }}
          title={isDark ? "Açık tema" : "Koyu tema"}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={openSearch}
          className="p-1.5 rounded-lg hover:bg-cream-200 transition-colors flex items-center gap-1.5"
          style={{ color: "var(--text-tertiary)" }}
          title="Ara (Cmd+K)"
        >
          <Search size={18} />
          <kbd
            className="hidden lg:inline px-1 py-0.5 text-[10px] rounded"
            style={{
              background: "var(--surface-sunken)",
              color: "var(--text-muted)",
              border: "0.5px solid var(--border-default)",
              fontFamily: "inherit",
            }}
          >
            Cmd+K
          </kbd>
        </button>
        <button
          onClick={() => openEventModal()}
          className="cp-btn cp-btn-ghost text-xs gap-1.5 hidden sm:inline-flex"
        >
          <CalendarPlus size={14} />
          <span className="hidden lg:inline">Etkinlik</span>
        </button>
        <button
          onClick={() => openTaskModal()}
          className="cp-btn cp-btn-primary text-xs gap-1.5 hidden md:inline-flex"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Yeni görev</span>
        </button>
        {/* Cikis yap — sadece giris yapilmissa ve demo degilse */}
        {user && !isDemoMode && (
          <button
            onClick={() => signOut()}
            className="p-1.5 rounded-lg hover:bg-cream-200 transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            title="Çıkış yap"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
