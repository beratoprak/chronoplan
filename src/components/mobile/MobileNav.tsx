"use client";

import { useState } from "react";
import { CalendarDays, GraduationCap, Columns3, FileText, Plus, X, CheckSquare, CalendarPlus, PenLine } from "lucide-react";
import { format } from "date-fns";
import { useAppStore } from "@/lib/store";
import type { ViewType } from "@/types";

const NAV_ITEMS: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: "daily", label: "Bugün", icon: CalendarDays },
  { id: "school", label: "Okul", icon: GraduationCap },
  { id: "kanban", label: "Görevler", icon: Columns3 },
  { id: "notes", label: "Notlar", icon: FileText },
];

/** Telefonda not-odaklı beşli gezinme ve bağlama duyarlı hızlı yakalama. */
export function MobileNav() {
  const [captureOpen, setCaptureOpen] = useState(false);
  const { currentView, selectedDate, setSelectedDate, setView, openTaskModal, openEventModal } = useAppStore();
  const today = format(new Date(), "yyyy-MM-dd");

  const actions = [
    {
      label: "Günlük nota yaz",
      description: "Düşünceyi seçili güne yakala",
      icon: PenLine,
      run: () => {
        setSelectedDate(selectedDate || today);
        setView("daily");
        setCaptureOpen(false);
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("epoche:focus-day-note")), 120);
      },
    },
    {
      label: "Görev ekle",
      description: "Son tarih ve çalışma zamanı planla",
      icon: CheckSquare,
      run: () => {
        setCaptureOpen(false);
        openTaskModal(undefined, { dueDate: selectedDate || today, scheduledDate: selectedDate || today });
      },
    },
    {
      label: "Etkinlik ekle",
      description: "Takvimde bir zaman bloğu oluştur",
      icon: CalendarPlus,
      run: () => {
        setCaptureOpen(false);
        openEventModal(undefined, { date: selectedDate || today });
      },
    },
  ];

  const renderItem = (item: (typeof NAV_ITEMS)[number]) => {
    const Icon = item.icon;
    const isActive = currentView === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setView(item.id)}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[58px] transition-colors"
        style={{ color: isActive ? "var(--brand-gold-hover)" : "var(--text-tertiary)" }}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
        <span className="text-[10px] font-medium">{item.label}</span>
      </button>
    );
  };

  return (
    <>
      {captureOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Hızlı ekle">
          <button
            className="absolute inset-0 w-full h-full bg-black/30"
            onClick={() => setCaptureOpen(false)}
            aria-label="Hızlı ekle penceresini kapat"
          />
          <section
            className="absolute inset-x-0 bottom-0 rounded-t-3xl px-5 pt-4 pb-[calc(22px+env(safe-area-inset-bottom))] animate-modal-in"
            style={{ background: "var(--surface-raised)", boxShadow: "0 -16px 40px rgba(44,37,24,.18)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[16px] font-semibold" style={{ color: "var(--text-primary)" }}>Hızlı yakala</p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>Aklındakini doğru yere bırak.</p>
              </div>
              <button onClick={() => setCaptureOpen(false)} className="cp-icon-button" aria-label="Kapat">
                <X size={19} />
              </button>
            </div>
            <div className="grid gap-2">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={action.run}
                    className="flex items-center gap-3 text-left rounded-2xl p-3.5 min-h-[64px] transition-transform active:scale-[.99]"
                    style={{ background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}
                  >
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-gold-light)", color: "var(--brand-gold-hover)" }}>
                      <Icon size={20} />
                    </span>
                    <span>
                      <span className="block text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>{action.label}</span>
                      <span className="block text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>{action.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <nav
        className="fixed bottom-0 inset-x-0 z-30 flex items-stretch md:hidden"
        style={{
          background: "color-mix(in srgb, var(--surface-raised) 92%, transparent)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderTop: "1px solid var(--border-default)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {renderItem(NAV_ITEMS[0])}
        {renderItem(NAV_ITEMS[1])}
        <button
          onClick={() => setCaptureOpen(true)}
          className="flex-1 min-h-[58px] flex items-center justify-center"
          aria-label="Hızlı ekle"
          aria-expanded={captureOpen}
        >
          <span
            className="w-12 h-12 -mt-5 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: "var(--brand-gold)", color: "var(--text-inverse)", border: "4px solid var(--surface-raised)" }}
          >
            <Plus size={23} strokeWidth={2.2} />
          </span>
        </button>
        {renderItem(NAV_ITEMS[2])}
        {renderItem(NAV_ITEMS[3])}
      </nav>
    </>
  );
}
