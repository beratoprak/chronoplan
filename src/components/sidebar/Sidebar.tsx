"use client";

import {
  CalendarDays,
  LayoutGrid,
  CalendarRange,
  Columns3,
  Settings,
  Users,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MiniCalendar } from "./MiniCalendar";
import type { ViewType } from "@/types";

const VIEW_ITEMS: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: "daily", label: "Gunluk detay", icon: CalendarDays },
  { id: "weekly", label: "Haftalik timeline", icon: CalendarRange },
  { id: "monthly", label: "Aylik gorunum", icon: LayoutGrid },
  { id: "kanban", label: "Kanban board", icon: Columns3 },
];

const TAG_DOTS: { label: string; color: string }[] = [
  { label: "Is", color: "var(--tag-work)" },
  { label: "Kisisel", color: "var(--tag-personal)" },
  { label: "Proje", color: "var(--tag-project)" },
  { label: "Toplanti", color: "var(--tag-meeting)" },
];

export function Sidebar() {
  const { currentView, setView, sidebarOpen, openSettings, openWorkspaceModal } = useAppStore();

  if (!sidebarOpen) return null;

  return (
    <aside
      className={cn(
        "flex flex-col gap-4 p-3.5 h-screen overflow-y-auto shrink-0",
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
      <div className="px-1 pt-1">
        <h1
          className="text-xl font-medium tracking-wide"
          style={{ fontFamily: "var(--font-serif, 'Cormorant Garamond', Georgia, serif)" }}
        >
          <span style={{ color: "var(--text-secondary)" }}>Chrono</span>
          <span style={{ color: "var(--brand-gold)" }}>Plan</span>
        </h1>
      </div>

      {/* Mini Calendar */}
      <MiniCalendar />

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5">
        <span
          className="text-[10px] uppercase tracking-wider px-3 pb-1"
          style={{ color: "var(--text-tertiary)" }}
        >
          Gorunumler
        </span>
        {VIEW_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "cp-nav-item",
                isActive && "active"
              )}
            >
              <Icon size={15} style={{ color: "var(--brand-gold)" }} />
              {item.label}
            </button>
          );
        })}
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
          <div
            key={tag.label}
            className="flex items-center gap-2 text-xs cursor-pointer py-0.5 hover:opacity-80 transition-opacity"
            style={{ color: "var(--text-secondary)" }}
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: tag.color }}
            />
            {tag.label}
          </div>
        ))}
      </div>

      {/* Workspace (Faz 8) */}
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
