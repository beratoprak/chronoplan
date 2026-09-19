"use client";

import {
  CalendarDays,
  LayoutGrid,
  CalendarRange,
  Columns3,
  Settings,
  Users,
  FileText,
  BookOpen,
  Timer,
  GraduationCap,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MiniCalendar } from "./MiniCalendar";
import type { ViewType } from "@/types";

const VIEW_ITEMS: { id: ViewType; label: string; icon: React.ElementType; group?: string }[] = [
  { id: "daily", label: "Bugün", icon: CalendarDays, group: "Takvim" },
  { id: "weekly", label: "Haftalık", icon: CalendarRange, group: "Takvim" },
  { id: "monthly", label: "Aylık", icon: LayoutGrid, group: "Takvim" },
  { id: "kanban", label: "Görevler", icon: Columns3, group: "Planlama" },
  { id: "notes", label: "Notlar", icon: FileText, group: "Planlama" },
  { id: "pomodoro", label: "Odak", icon: Timer, group: "Planlama" },
  { id: "media", label: "Arşiv", icon: BookOpen, group: "Planlama" },
  { id: "school", label: "Okul", icon: GraduationCap, group: "Okul" },
];

const TAG_DOTS: { label: string; color: string }[] = [
  { label: "İş", color: "var(--tag-work)" },
  { label: "Kişisel", color: "var(--tag-personal)" },
  { label: "Proje", color: "var(--tag-project)" },
  { label: "Toplantı", color: "var(--tag-meeting)" },
  { label: "Okul", color: "var(--tag-school)" },
];

export function Sidebar() {
  const { currentView, setView, sidebarOpen, openSettings, openWorkspaceModal, isDemoMode, tags, setKanbanFilter } = useAppStore();

  if (!sidebarOpen) return null;

  return (
    <aside
      className={cn(
        "flex flex-col gap-4 p-3.5 h-screen supports-[height:100dvh]:h-[100dvh] overflow-y-auto shrink-0",
        // Mobile: overlay, fixed, z-40
        "fixed lg:relative z-40 lg:z-auto",
        "transition-transform duration-200 ease-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
      style={{
        width: "var(--sidebar-width)",
        background: "var(--surface-sunken)",
        borderRight: "0.5px solid var(--border-strong)",
      }}
    >
      {/* Logo */}
      <div className="px-1 pt-1 flex items-center gap-2">
        <img src="/logo-espresso.png" alt="Epoche logo" style={{ width: 32, height: 32 }} />
        <h1
          className="text-xl font-medium tracking-wide"
          style={{ fontFamily: "var(--font-serif, 'Cormorant Garamond', Georgia, serif)" }}
        >
          <span style={{ color: "var(--brand-gold)" }}>Epoche</span>
        </h1>
      </div>

      {/* Mini Calendar */}
      <MiniCalendar />

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5">
        {["Takvim", "Planlama", "Okul"].map((group) => (
          <div key={group} className="flex flex-col gap-0.5">
            <span
              className="text-[10px] uppercase tracking-wider px-3 pb-0.5 pt-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {group}
            </span>
            {VIEW_ITEMS.filter((v) => v.group === group).map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setView(item.id);
                    // Mobilde seçimden sonra sidebar'ı kapat
                    if (typeof window !== "undefined" && window.innerWidth < 1024) {
                      useAppStore.setState({ sidebarOpen: false });
                    }
                  }}
                  className={cn("cp-nav-item", isActive && "active")}
                >
                  <Icon size={15} style={{ color: "var(--brand-gold)" }} />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Tags */}
      <div className="mt-auto flex flex-col gap-1 px-3 pb-2">
        <span
          className="text-[10px] uppercase tracking-wider pb-1"
          style={{ color: "var(--text-tertiary)" }}
        >
          Etiketler
        </span>
        {TAG_DOTS.map((tag) => (
          <button
            key={tag.label}
            onClick={() => {
              const matched = tags.find((item) => item.name === tag.label);
              if (matched) setKanbanFilter({ tagId: matched.id });
              setView("kanban");
            }}
            className="flex items-center gap-2 text-xs text-left min-h-8 hover:opacity-80 transition-opacity"
            style={{ color: "var(--text-secondary)" }}
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: tag.color }}
            />
            {tag.label}
          </button>
        ))}
      </div>

      {/* Workspace (Faz 8) — demo modunda gizle */}
      {!isDemoMode && (
        <div className="px-1">
          <button
            onClick={openWorkspaceModal}
            className="cp-nav-item w-full"
            style={{ color: "var(--text-tertiary)" }}
          >
            <Users size={15} />
            <span className="text-xs">Workspace</span>
          </button>
        </div>
      )}

      {/* Settings (Faz 7) */}
      <div className="px-1 pb-1">
        <button
          onClick={openSettings}
          className="cp-nav-item w-full"
          style={{ color: "var(--text-tertiary)" }}
        >
          <Settings size={15} />
          <span className="text-xs">Ayarlar</span>
        </button>
      </div>
    </aside>
  );
}
