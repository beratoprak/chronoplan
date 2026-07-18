"use client";

import { useRef, useState } from "react";
import { X, Sun, Moon, Monitor, Download, FileText, Calendar, ListTodo, Keyboard, Info, DatabaseBackup, Upload, CalendarClock, Copy, Check, CloudUpload, RefreshCw } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { exportTasksToCSV, exportNotesToMarkdown, exportEventsToICS, exportFullBackup, parseBackupFile } from "@/lib/export";
import { outboxSize, flushOutbox } from "@/lib/supabase-sync";
import { formatRelativeTime } from "@/lib/dates";
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
  const { isSettingsOpen, closeSettings, theme, setTheme, tasks, notes, events, tags, richNotes, mediaItems, workSessions, pomodoroSettings, importBackup, user, isDemoMode, lastSyncAt, syncStatus, syncFromSupabase } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [pendingCount, setPendingCount] = useState(() => outboxSize());

  async function handleSyncNow() {
    setSyncingNow(true);
    await flushOutbox();
    await syncFromSupabase();
    setPendingCount(outboxSize());
    setSyncingNow(false);
  }

  const icsUrl =
    user && typeof window !== "undefined"
      ? `${window.location.origin}/api/ics?token=${user.id}`
      : null;

  function copyIcsUrl() {
    if (!icsUrl) return;
    void navigator.clipboard.writeText(icsUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!isSettingsOpen) return null;

  const totalRecords = tasks.length + notes.length + events.length + richNotes.length + mediaItems.length + workSessions.length;

  function handleBackupDownload() {
    exportFullBackup({ tasks, notes, events, tags, richNotes, mediaItems, workSessions, pomodoroSettings });
  }

  function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = parseBackupFile(String(reader.result ?? ""));
      if (!data) {
        setRestoreMessage("Geçersiz yedek dosyası — Epoche yedeği değil.");
        return;
      }
      const imported = importBackup(data);
      setRestoreMessage(
        imported > 0
          ? `${imported} kayıt geri yüklendi. Mevcut daha yeni kayıtlara dokunulmadı.`
          : "Yedekteki her şey zaten güncel — değişiklik gerekmedi."
      );
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in"
      style={{ background: "var(--surface-overlay)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSettings();
      }}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl sm:rounded-xl overflow-hidden animate-modal-in"
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

          {/* ── Senkronizasyon Durumu ─────────────── */}
          {user && !isDemoMode && (
            <div>
              <h3
                className="text-[11px] font-medium uppercase tracking-wider mb-3"
                style={{ color: "var(--text-tertiary)" }}
              >
                <CloudUpload size={12} className="inline mr-1" />
                Bulut Senkronizasyonu
              </h3>
              <div
                className="rounded-lg p-3 flex flex-col gap-2"
                style={{
                  background: pendingCount > 0 ? "var(--priority-medium-bg)" : "var(--priority-low-bg)",
                  border: "0.5px solid var(--border-default)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span
                      className="text-[13px] font-medium"
                      style={{ color: pendingCount > 0 ? "var(--priority-medium-text)" : "var(--priority-low-text)" }}
                    >
                      {pendingCount > 0
                        ? `${pendingCount} kayıt gönderilmeyi bekliyor`
                        : "Her şey bulutta ✓"}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                      {lastSyncAt
                        ? `Son eşitleme: ${formatRelativeTime(lastSyncAt)}`
                        : "Henüz eşitlenmedi"}
                      {syncStatus === "error" && " · Son deneme başarısız"}
                    </span>
                  </div>
                  <button
                    onClick={handleSyncNow}
                    disabled={syncingNow}
                    className="cp-btn cp-btn-ghost text-[11px] px-2.5 py-1.5 gap-1 shrink-0"
                  >
                    <RefreshCw size={12} className={syncingNow ? "animate-spin" : ""} />
                    Şimdi Eşitle
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Tam Yedekleme ────────────────────── */}
          <div>
            <h3
              className="text-[11px] font-medium uppercase tracking-wider mb-3"
              style={{ color: "var(--text-tertiary)" }}
            >
              <DatabaseBackup size={12} className="inline mr-1" />
              Tam Yedekleme
            </h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleBackupDownload}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:ring-1 hover:ring-[var(--border-accent)]"
                style={{
                  border: "0.5px solid var(--border-default)",
                  background: "var(--surface-base)",
                  color: "var(--text-secondary)",
                }}
              >
                <Download size={16} style={{ color: "var(--brand-gold)" }} />
                <div>
                  <div className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    Tüm Veriyi İndir (JSON)
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    {totalRecords} kayıt — görevler, notlar, etkinlikler, medya, pomodoro
                  </div>
                </div>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:ring-1 hover:ring-[var(--border-accent)]"
                style={{
                  border: "0.5px solid var(--border-default)",
                  background: "var(--surface-base)",
                  color: "var(--text-secondary)",
                }}
              >
                <Upload size={16} style={{ color: "var(--brand-gold)" }} />
                <div>
                  <div className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    Yedekten Geri Yükle
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    Yedek dosyası mevcut veriyle güvenle birleştirilir, silme yapmaz
                  </div>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleRestoreFile}
              />
              {restoreMessage && (
                <p className="text-[11px] px-1" style={{ color: "var(--brand-gold)" }}>
                  {restoreMessage}
                </p>
              )}
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

          {/* ── Takvim Aboneliği (Widget) ─────────── */}
          {icsUrl && !isDemoMode && (
            <div>
              <h3
                className="text-[11px] font-medium uppercase tracking-wider mb-3"
                style={{ color: "var(--text-tertiary)" }}
              >
                <CalendarClock size={12} className="inline mr-1" />
                Takvim Aboneliği — iPhone & Mac Widget
              </h3>
              <div
                className="rounded-lg p-3 flex flex-col gap-2"
                style={{ background: "var(--surface-base)", border: "0.5px solid var(--border-default)" }}
              >
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  Bu adrese abone olursanız Epoche etkinlikleriniz iPhone/Mac
                  Takvim uygulamasında ve takvim widget&apos;larında görünür:
                </p>
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 text-[10px] px-2 py-1.5 rounded truncate"
                    style={{ background: "var(--surface-sunken)", color: "var(--text-tertiary)" }}
                  >
                    {icsUrl}
                  </code>
                  <button
                    onClick={copyIcsUrl}
                    className="cp-btn cp-btn-ghost text-[11px] px-2 py-1.5 shrink-0 gap-1"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? "Kopyalandı" : "Kopyala"}
                  </button>
                </div>
                <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  <strong>iPhone:</strong> Ayarlar → Uygulamalar → Takvim → Hesaplar → Hesap Ekle →
                  Diğer → Takvim Aboneliği Ekle → adresi yapıştır.
                  <br />
                  <strong>Mac:</strong> Takvim uygulaması → Dosya → Yeni Takvim Aboneliği.
                  <br />
                  <strong>Google Takvim:</strong> Diğer takvimler → + → URL ile ekle.
                </p>
              </div>
            </div>
          )}

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
                Epoche v1.0.0 · yapı {process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}
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
