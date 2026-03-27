"use client";

import { parseISO } from "date-fns";
import { Menu, Plus, Search, CalendarPlus, LogOut, Loader2, Sun, Moon } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { formatDate, MONTH_NAMES_TR, DAY_NAMES_TR } from "@/lib/dates";
import type { ViewType } from "@/types";

const VIEW_TABS: { id: ViewType; label: string }[] = [
  { id: "daily", label: "Gunluk" },
  { id: "weekly", label: "Haftalik" },
  { id: "monthly", label: "Aylik" },
  { id: "kanban", label: "Kanban" },
];

export function Topbar() {
  const { selectedDate, currentView, setView, toggleSidebar, openTaskModal, openEventModal, openSearch, user, syncStatus, signOut, theme, setTheme } = useAppStore();
  const date = parseISO(selectedDate);
  const dayOfWeek = DAY_NAMES_TR[(date.getDay() + 6) % 7]; // Monday-first

  const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

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
          className="p-1.5 rounded-lg hover:bg-cream-200 transition-colors shrink-0"
          style={{ color: "var(--text-tertiary)" }}
        >
          <Menu size={18} />
        </button>
        <div className="flex items-baseline gap-1 sm:gap-2 min-w-0">
          <h2 className="text-sm sm:text-base font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {date.getDate()} {MONTH_NAMES_TR[date.getMonth()]} {date.getFullYear()}
          </h2>
          <span className="text-xs sm:text-sm hidden sm:inline" style={{ color: "var(--text-tertiary)" }}>
            {dayOfWeek}
          </span>
        </div>
      </div>

      {/* Center: view tabs — hidden on mobile */}
      <div className="cp-view-tabs hidden md:flex">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={cn("cp-view-tab", currentView === tab.id && "active")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Sync gostergesi */}
        {syncStatus === "syncing" && (
          <Loader2
            size={15}
            className="animate-spin"
            style={{ color: "var(--text-muted)" }}
          />
        )}
        {/* Dark mode toggle (Faz 7) */}
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="p-1.5 rounded-lg hover:bg-cream-200 transition-colors"
          style={{ color: "var(--text-tertiary)" }}
          title={isDark ? "Acik tema" : "Koyu tema"}
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
          className="cp-btn cp-btn-primary text-xs gap-1.5"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Yeni gorev</span>
        </button>
        {/* Cikis yap — sadece giris yapilmissa */}
        {user && (
          <button
            onClick={() => signOut()}
            className="p-1.5 rounded-lg hover:bg-cream-200 transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            title="Cikis Yap"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </header>
  );
}