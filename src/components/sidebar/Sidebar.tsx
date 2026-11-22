"use client";

import { useEffect, useState } from "react";
import {
  X,
  Check,
  PanelBottom,
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
  NotebookPen,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MiniCalendar } from "./MiniCalendar";
import { altCubuguOku, altCubuguYaz, altCubukDegistir, ALT_CUBUK_SAYI, VARSAYILAN_ALT_CUBUK } from "@/lib/alt-cubuk";
import type { ViewType } from "@/types";

export const VIEW_ITEMS: { id: ViewType; label: string; icon: React.ElementType; group?: string }[] = [
  { id: "daily", label: "Bugün", icon: CalendarDays, group: "Takvim" },
  { id: "weekly", label: "Haftalık", icon: CalendarRange, group: "Takvim" },
  { id: "monthly", label: "Aylık", icon: LayoutGrid, group: "Takvim" },
  { id: "kanban", label: "Görevler", icon: Columns3, group: "Planlama" },
  { id: "notes", label: "Notlar", icon: FileText, group: "Planlama" },
  { id: "pomodoro", label: "Odak", icon: Timer, group: "Planlama" },
  { id: "media", label: "Arşiv", icon: BookOpen, group: "Planlama" },
  { id: "school", label: "Okul", icon: GraduationCap, group: "Okul" },
  { id: "okul-notlari", label: "Okul notları", icon: NotebookPen, group: "Okul" },
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

  // Telefon: alt çubukta duracak ekranları seçme kipi ("Çubuğu düzenle").
  const [duzenle, setDuzenle] = useState(false);
  const [cubuk, setCubuk] = useState<ViewType[]>(VARSAYILAN_ALT_CUBUK);
  useEffect(() => {
    if (sidebarOpen) setCubuk(altCubuguOku());
    else setDuzenle(false);
  }, [sidebarOpen]);

  if (!sidebarOpen) return null;

  return (
    <aside
      className={cn(
        "mobil-ilk-gizle flex flex-col gap-4 p-3.5 h-screen supports-[height:100dvh]:h-[100dvh] overflow-y-auto shrink-0",
        // Mobile: overlay, fixed, z-40
        "fixed lg:relative z-40 lg:z-auto",
        "transition-transform duration-200 ease-out",
        // Telefon (md altı): soldan çekmece yerine alttan açılan "Daha fazla" sayfası.
        // İçerik masaüstündekiyle aynı; yalnız telefonda başlık ve sıralama değişir.
        "max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:!w-auto max-md:!h-auto max-md:max-h-[85dvh]",
        "max-md:rounded-t-3xl max-md:!border-r-0 max-md:animate-modal-in max-md:gap-3",
        "max-md:px-5 max-md:pt-4 max-md:pb-[calc(22px+env(safe-area-inset-bottom))]",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
      style={{
        width: "var(--sidebar-width)",
        background: "var(--surface-sunken)",
        borderRight: "0.5px solid var(--border-strong)",
      }}
    >
      {/* Telefon başlığı — hızlı ekle sayfasıyla aynı düzen */}
      <div className="md:hidden flex items-center justify-between">
        <div>
          <p className="text-[16px] font-semibold" style={{ color: "var(--text-primary)" }}>
            {duzenle ? "Alt çubuk" : "Daha fazla"}
          </p>
          {duzenle && (
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              Çubukta duracak {ALT_CUBUK_SAYI} ekranı seç.
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
        <button
          onClick={() => setDuzenle((d) => !d)}
          className="cp-icon-button"
          aria-label={duzenle ? "Düzenlemeyi bitir" : "Alt çubuğu düzenle"}
          aria-pressed={duzenle}
          style={duzenle ? { color: "var(--brand-gold-hover)" } : undefined}
        >
          {duzenle ? <Check size={19} /> : <PanelBottom size={18} />}
        </button>
        <button
          onClick={() => {
            useAppStore.setState({ sidebarOpen: false });
            openSettings();
          }}
          className="cp-icon-button"
          aria-label="Ayarlar"
        >
          <Settings size={18} />
        </button>
        <button
          onClick={() => useAppStore.setState({ sidebarOpen: false })}
          className="cp-icon-button"
          aria-label="Kapat"
        >
          <X size={19} />
        </button>
        </div>
      </div>

      {/* Logo */}
      <div className="px-1 pt-1 max-md:hidden flex items-center gap-2">
        <img src="/logo-espresso.png" alt="Epoche logo" style={{ width: 32, height: 32 }} />
        <h1
          className="text-xl font-medium tracking-wide"
          style={{ fontFamily: "var(--font-serif, 'Cormorant Garamond', Georgia, serif)" }}
        >
          <span style={{ color: "var(--brand-gold)" }}>Epoche</span>
        </h1>
      </div>

      {/* Mini Calendar */}
      {/* Telefonda ekranlar önce, takvim onların altında */}
      <div className="max-md:order-2">
        <MiniCalendar />
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 max-md:order-1">
        {["Takvim", "Planlama", "Okul"].map((group) => (
          <div key={group} className="flex flex-col gap-0.5 max-md:grid max-md:grid-cols-2 max-md:gap-x-1">
            <span
              className="text-[10px] uppercase tracking-wider px-3 pb-0.5 pt-1 max-md:col-span-2"
              style={{ color: "var(--text-tertiary)" }}
            >
              {group}
            </span>
            {VIEW_ITEMS.filter((v) => v.group === group).map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              const cubukta = cubuk.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (duzenle) {
                      const yeni = altCubukDegistir(cubuk, item.id);
                      setCubuk(yeni);
                      altCubuguYaz(yeni);
                      return;
                    }
                    setView(item.id);
                    // Mobilde seçimden sonra sidebar'ı kapat
                    if (typeof window !== "undefined" && window.innerWidth < 1024) {
                      useAppStore.setState({ sidebarOpen: false });
                    }
                  }}
                  className={cn("cp-nav-item", (duzenle ? cubukta : isActive) && "active")}
                  aria-pressed={duzenle ? cubukta : undefined}
                >
                  <Icon size={15} style={{ color: "var(--brand-gold)" }} />
                  {item.label}
                  {duzenle && cubukta && <Check size={14} className="ml-auto" style={{ color: "var(--brand-gold)" }} />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Tags */}
      <div className="mt-auto flex flex-col gap-1 px-3 pb-2 max-md:order-3 max-md:flex-row max-md:flex-wrap max-md:gap-x-4">
        <span
          className="text-[10px] uppercase tracking-wider pb-1 max-md:w-full"
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
              // Etiket düğmeleri kapatmayı atlıyordu: mobilde çekmece açık
              // kalıp gittiğin görünümün üstünü örtüyordu.
              if (typeof window !== "undefined" && window.innerWidth < 1024) {
                useAppStore.setState({ sidebarOpen: false });
              }
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
        <div className="px-1 max-md:order-4">
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
      <div className="px-1 pb-1 max-md:hidden">
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
