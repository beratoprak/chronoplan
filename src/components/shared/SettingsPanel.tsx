"use client";

import { X, Sun, Moon, Monitor, Download, FileText, Calendar, ListTodo, Keyboard, Info } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { exportTasksToCSV, exportNotesToMarkdown, exportEventsToICS } from "@/lib/export";
import type { ThemeMode } from "@/types";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ElementType }[] = [
  { value: "light", label: "Acik", icon: Sun },
  { value: "dark", label: "Koyu", icon: Moon },
  { value: "system", label: "Sistem", icon: Monitor },
];

const SHORTCUTS = [
  { keys: ["←", "→"], desc: "Gun degistir" },
  { keys: ["T"], desc: "Bugune don" },
  { keys: ["1", "2", "3", "4"], desc: "Gorunum degistir" },
  { keys: ["⌘", "N"], desc: "Yeni gorev" },
  { keys: ["⌘", "E"], desc: "Yeni etkinlik" },
  { keys: ["⌘", "K"], desc: "Arama" },
  { keys: ["⌘", ","], desc: "Ayarlar" },
];

export function SettingsPanel() {
  const { isSettingsOpen, closeSettings, theme, setTheme, tasks, notes, events } = useAppStore();

  if (!isSettingsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: "var(--surface-overlay)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSettings();
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl overflow-hidden animate-modal-in"
        style={{
          background: "var(--surface-raised)",
          border: "0.5px solid var(--border-default)",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "0.5px solid var(--border-default)" }}
        >
          <h2 className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
            Ayarlar
          </h2>
          <button
            onClick={closeSettings}
            className="p-1 rounded-lg transition-colors hover:bg-cream-200"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-6" style={{ maxHeight: "calc(85vh - 60px)" }}>
          {/* ── Tema ─────────────────────────────── */}
          <div>
            <h3
              className="text-[11px] font-medium uppercase tracking-wider mb-3"
              style={{ color: "var(--text-tertiary)" }}
            >
              Tema
            </h3>
            <div className="flex gap-2">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className="flex-1 flex flex-col items-center gap-2 py-3 px-3 rounded-lg transition-all"
                  style={{
                    border: theme === value
                      ? "1.5px solid var(--brand-gold)"
                      : "0.5px solid var(--border-default)",
                    background: theme === value
                      ? "var(--brand-gold-light)"
                      : "var(--surface-base)",
                    color: theme === value
                      ? "var(--brand-gold)"
                      : "var(--text-secondary)",
                  }}
                >
                  <Icon size={18} />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Disa Aktar ───────────────────────── */}
          <div>
            <h3
              className="text-[11px] font-medium uppercase tracking-wider mb-3"
              style={{ color: "var(--text-tertiary)" }}
            >
              <Download size={12} className="inline mr-1" />
              Disa Aktar
            </h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => exportTasksToCSV(tasks)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:ring-1 hover:ring-[var(--border-accent)]"
                style={{
                  border: "0.5px solid var(--border-default)",
                  background: "var(--surface-base)",
                  color: "var(--text-secondary)",
                }}
              >
                <ListTodo size={16} style={{ color: "var(--brand-gold)" }} />
                <div>
                  <div className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    Gorevler (CSV)
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    {tasks.length} gorev
                  </div>
                </div>
              </button>
              <button
                onClick={() => exportNotesToMarkdown(notes)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:ring-1 hover:ring-[var(--border-accent)]"
                style={{
                  border: "0.5px solid var(--border-default)",
                  background: "var(--surface-base)",
                  color: "var(--text-secondary)",
                }}
              >
                <FileText size={16} style={{ color: "var(--brand-gold)" }} />
                <div>
                  <div className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    Notlar (Markdown)
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    {notes.length} not
                  </div>
                </div>
              </button>
              <button
                onClick={() => exportEventsToICS(events)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:ring-1 hover:ring-[var(--border-accent)]"
                style={{
                  border: "0.5px solid var(--border-default)",
                  background: "var(--surface-base)",
                  color: "var(--text-secondary)",
                }}
              >
                <Calendar size={16} style={{ color: "var(--brand-gold)" }} />
                <div>
                  <div className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    Etkinlikler (ICS)
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    {events.length} etkinlik — Takvim uygulamalarina aktarabilirsin
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* ── Kisayollar ───────────────────────── */}
          <div>
            <h3
              className="text-[11px] font-medium uppercase tracking-wider mb-3"
              style={{ color: "var(--text-tertiary)" }}
            >
              <Keyboard size={12} className="inline mr-1" />
              Klavye Kisayollari
            </h3>
            <div className="flex flex-col gap-1.5">
              {SHORTCUTS.map((shortcut) => (
                <div
                  key={shortcut.desc}
                  className="flex items-center justify-between px-3 py-1.5 rounded-md"
                  style={{ background: "var(--surface-base)" }}
                >
                  <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    {shortcut.desc}
                  </span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((key) => (
                      <kbd
                        key={key}
                        className="px-1.5 py-0.5 text-[10px] rounded"
                        style={{
                          background: "var(--surface-raised)",
                          color: "var(--text-tertiary)",
                          border: "0.5px solid var(--border-default)",
                        }}
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Hakkinda ─────────────────────────── */}
          <div
            className="rounded-lg p-3"
            style={{ background: "var(--surface-base)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Info size={13} style={{ color: "var(--text-tertiary)" }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                ChronoPlan v0.8.0
              </span>
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Profesyonel takvim & planlama uygulamasi.
              <br />
              beratoprak.com tarafindan gelistirilmistir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
