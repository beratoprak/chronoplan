"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Search, X, CheckSquare, Calendar, FileText, ArrowRight } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { getPriorityLabel, getTagColorLabel } from "@/lib/utils";
import type { SearchResult } from "@/types";

export function SearchModal() {
  const {
    isSearchOpen,
    closeSearch,
    tasks,
    events,
    notes,
    setSelectedDate,
    setView,
    openTaskModal,
  } = useAppStore();

  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K ile aç
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        useAppStore.getState().openSearch();
      }
      if (e.key === "Escape" && isSearchOpen) {
        closeSearch();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen, closeSearch]);

  // Açıldığında input'a odaklan
  useEffect(() => {
    if (isSearchOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isSearchOpen]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const out: SearchResult[] = [];

    // Görevler
    for (const task of tasks) {
      if (
        task.title.toLowerCase().includes(q) ||
        task.description?.toLowerCase().includes(q)
      ) {
        out.push({
          type: "task",
          id: task.id,
          title: task.title,
          subtitle: `${getPriorityLabel(task.priority)} · ${task.date}`,
          date: task.date,
        });
      }
    }

    // Etkinlikler
    for (const event of events) {
      if (
        event.title.toLowerCase().includes(q) ||
        event.description?.toLowerCase().includes(q)
      ) {
        out.push({
          type: "event",
          id: event.id,
          title: event.title,
          subtitle: `${event.startTime ?? "Tüm gün"} · ${getTagColorLabel(event.tagColor)}`,
          date: event.date,
        });
      }
    }

    // Notlar
    for (const note of notes) {
      if (note.plainText.toLowerCase().includes(q)) {
        const preview = note.plainText.slice(0, 80).replace(/\n/g, " ");
        out.push({
          type: "note",
          id: note.id,
          title: `Not — ${note.date}`,
          subtitle: preview,
          date: note.date,
        });
      }
    }

    return out.slice(0, 20);
  }, [query, tasks, events, notes]);

  // Sonuca tıklayınca navigate et
  function handleSelect(result: SearchResult) {
    setSelectedDate(result.date);
    if (result.type === "task") {
      setView("kanban");
      const task = tasks.find((t) => t.id === result.id);
      if (task) openTaskModal(task);
    } else if (result.type === "event") {
      setView("daily");
    } else {
      setView("daily");
    }
    closeSearch();
  }

  if (!isSearchOpen) return null;

  const grouped = {
    task: results.filter((r) => r.type === "task"),
    event: results.filter((r) => r.type === "event"),
    note: results.filter((r) => r.type === "note"),
  };

  const hasResults = results.length > 0;
  const showEmpty = query.trim().length > 0 && !hasResults;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      style={{ background: "var(--surface-overlay)" }}
      onClick={closeSearch}
    >
      <div
        className="w-full max-w-xl animate-modal-in overflow-hidden"
        style={{
          background: "var(--surface-raised)",
          border: "0.5px solid var(--border-default)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "0 16px 48px rgba(44, 37, 24, 0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input satırı */}
        <div
          className="flex items-center gap-3 px-4"
          style={{
            borderBottom: hasResults || showEmpty ? "0.5px solid var(--border-subtle)" : "none",
            height: "52px",
          }}
        >
          <Search size={17} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Görev, etkinlik veya not ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: "14px", color: "var(--text-primary)" }}
          />
          <div className="flex items-center gap-2">
            {query && (
              <button
                onClick={() => setQuery("")}
                className="p-1 rounded"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={14} />
              </button>
            )}
            <kbd
              className="px-1.5 py-0.5 text-[11px] rounded"
              style={{
                background: "var(--surface-sunken)",
                color: "var(--text-muted)",
                border: "0.5px solid var(--border-default)",
                fontFamily: "inherit",
              }}
            >
              ESC
            </kbd>
          </div>
        </div>

        {/* Sonuçlar */}
        {hasResults && (
          <div className="overflow-y-auto" style={{ maxHeight: "420px" }}>
            {(["task", "event", "note"] as const).map((type) => {
              const items = grouped[type];
              if (items.length === 0) return null;

              const label = type === "task" ? "Görevler" : type === "event" ? "Etkinlikler" : "Notlar";
              const Icon = type === "task" ? CheckSquare : type === "event" ? Calendar : FileText;

              return (
                <div key={type}>
                  {/* Grup başlığı */}
                  <div
                    className="flex items-center gap-2 px-4 py-2"
                    style={{ borderBottom: "0.5px solid var(--border-subtle)" }}
                  >
                    <Icon size={12} style={{ color: "var(--text-muted)" }} />
                    <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      {label}
                    </span>
                  </div>

                  {/* Sonuç satırları */}
                  {items.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleSelect(result)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                      style={{
                        borderBottom: "0.5px solid var(--border-subtle)",
                        background: "transparent",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--surface-sunken)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[13px] font-medium truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {result.title}
                        </p>
                        {result.subtitle && (
                          <p
                            className="text-[11px] mt-0.5 truncate"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            {result.subtitle}
                          </p>
                        )}
                      </div>
                      <ArrowRight size={13} style={{ color: "var(--text-muted)", flexShrink: 0, marginLeft: "8px" }} />
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Boş durum */}
        {showEmpty && (
          <div className="py-10 text-center" style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            &quot;{query}&quot; için sonuç bulunamadı
          </div>
        )}

        {/* İpucu (query yok) */}
        {!query && (
          <div className="px-4 py-3 flex items-center gap-4" style={{ borderTop: "0.5px solid var(--border-subtle)" }}>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Görevler, etkinlikler ve notlar arasında arama yapın
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
