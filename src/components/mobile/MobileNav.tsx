"use client";

import { CalendarDays, LayoutGrid, Columns3, FileText, Timer } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ViewType } from "@/types";

const NAV_ITEMS: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: "daily", label: "Günlük", icon: CalendarDays },
  { id: "monthly", label: "Aylık", icon: LayoutGrid },
  { id: "kanban", label: "Kanban", icon: Columns3 },
  { id: "notes", label: "Notlar", icon: FileText },
  { id: "pomodoro", label: "Sayaç", icon: Timer },
];

/** Telefonda alt gezinme çubuğu — masaüstünde gizli. */
export function MobileNav() {
  const { currentView, setView } = useAppStore();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 flex items-stretch justify-around md:hidden"
      style={{
        background: "color-mix(in srgb, var(--surface-raised) 88%, transparent)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: "0.5px solid var(--border-default)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 flex-1 py-2 min-h-[52px] transition-colors"
            )}
            style={{ color: isActive ? "var(--brand-gold)" : "var(--text-tertiary)" }}
            aria-label={item.label}
          >
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
