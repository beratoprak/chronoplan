"use client";

import { useMemo, useState } from "react";
import { Plus, Filter } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { TaskCard } from "@/components/shared/TaskCard";
import { getStatusLabel, getPriorityLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { TaskStatus, Priority } from "@/types";

const COLUMNS: { status: TaskStatus; accent: string }[] = [
  { status: "planned", accent: "var(--status-planned-text)" },
  { status: "active", accent: "var(--status-active-text)" },
  { status: "done", accent: "var(--status-done-text)" },
];

const PRIORITIES: { value: Priority | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "urgent", label: "Acil" },
  { value: "high", label: "Yüksek" },
  { value: "medium", label: "Orta" },
  { value: "low", label: "Düşük" },
];

export function KanbanView() {
  const { tasks, moveTask, openTaskModal, tags, kanbanFilter, setKanbanFilter } = useAppStore();
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filtre uygula
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (kanbanFilter.priority !== "all" && t.priority !== kanbanFilter.priority) return false;
      if (kanbanFilter.tagId !== "all" && !t.tags.some((tag) => tag.id === kanbanFilter.tagId)) return false;
      return true;
    });
  }, [tasks, kanbanFilter]);

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, typeof filteredTasks> = { planned: [], active: [], done: [] };
    filteredTasks.forEach((t) => {
      if (map[t.status]) map[t.status].push(t);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.order - b.order));
    return map;
  }, [filteredTasks]);

  const isFiltered =
    kanbanFilter.priority !== "all" || kanbanFilter.tagId !== "all";

  // ── Drag & Drop Handlers ──────────────────────────────────

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, taskId: string) {
    setDraggingTaskId(taskId);
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    setDraggingTaskId(null);
    setDragOverColumn(null);
  }

  function handleDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) moveTask(taskId, status);
    setDragOverColumn(null);
    setDraggingTaskId(null);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDragEnter(status: TaskStatus) {
    setDragOverColumn(status);
  }

  function handleDragLeave(e: React.DragEvent, _status: TaskStatus) {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null);
    }
  }

  function handleAddTask(_status: TaskStatus) {
    openTaskModal();
  }

  return (
    <div className="flex flex-col h-full gap-3 animate-fade-in">
      {/* ── Filtre Çubuğu ────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn("cp-btn cp-btn-ghost text-xs gap-1.5")}
          style={
            isFiltered
              ? {
                  background: "var(--brand-gold-light)",
                  borderColor: "var(--brand-gold)",
                  color: "var(--brand-gold)",
                }
              : {}
          }
        >
          <Filter size={13} />
          Filtrele
          {isFiltered && (
            <span
              className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center"
              style={{ background: "var(--brand-gold)", color: "var(--text-inverse)" }}
            >
              !
            </span>
          )}
        </button>

        {showFilters && (
          <>
            {/* Öncelik filtreleri */}
            <div className="flex items-center gap-1">
              {PRIORITIES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setKanbanFilter({ priority: value })}
                  className="px-2.5 py-1 text-[11px] rounded-md transition-all"
                  style={{
                    border: "0.5px solid var(--border-default)",
                    background:
                      kanbanFilter.priority === value
                        ? "var(--brand-gold)"
                        : "var(--surface-raised)",
                    color:
                      kanbanFilter.priority === value
                        ? "var(--text-inverse)"
                        : "var(--text-secondary)",
                    fontWeight: kanbanFilter.priority === value ? 500 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Etiket filtreleri */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setKanbanFilter({ tagId: "all" })}
                className="px-2.5 py-1 text-[11px] rounded-md transition-all"
                style={{
                  border: "0.5px solid var(--border-default)",
                  background:
                    kanbanFilter.tagId === "all"
                      ? "var(--brand-gold)"
                      : "var(--surface-raised)",
                  color:
                    kanbanFilter.tagId === "all"
                      ? "var(--text-inverse)"
                      : "var(--text-secondary)",
                }}
              >
                Tüm etiket
              </button>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setKanbanFilter({ tagId: tag.id })}
                  className="px-2.5 py-1 text-[11px] rounded-md transition-all"
                  style={{
                    border: "0.5px solid var(--border-default)",
                    background:
                      kanbanFilter.tagId === tag.id
                        ? "var(--brand-gold)"
                        : "var(--surface-raised)",
                    color:
                      kanbanFilter.tagId === tag.id
                        ? "var(--text-inverse)"
                        : "var(--text-secondary)",
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>

            {/* Filtreyi temizle */}
            {isFiltered && (
              <button
                onClick={() => setKanbanFilter({ priority: "all", tagId: "all" })}
                className="text-[11px] underline"
                style={{ color: "var(--text-tertiary)", background: "transparent", border: "none", cursor: "pointer" }}
              >
                Temizle
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Kanban Kolonları ──────────────────────────────────── */}
      <div
        className="grid gap-4 flex-1 min-h-0 grid-cols-1 md:grid-cols-3"
      >
        {COLUMNS.map(({ status, accent }) => {
          const isDropTarget = dragOverColumn === status;

          return (
            <div
              key={status}
              className="flex flex-col rounded-xl p-3 transition-all duration-200 overflow-hidden"
              style={{
                background: isDropTarget
                  ? `color-mix(in srgb, var(--surface-sunken) 70%, var(--brand-gold-light) 30%)`
                  : "var(--surface-sunken)",
                outline: isDropTarget ? "2px dashed var(--brand-gold)" : "2px dashed transparent",
                outlineOffset: "-2px",
              }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status)}
              onDragEnter={() => handleDragEnter(status)}
              onDragLeave={(e) => handleDragLeave(e, status)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: accent }} />
                  <h4
                    className="text-[13px] font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {getStatusLabel(status)}
                  </h4>
                </div>
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full"
                  style={{
                    background: "var(--surface-raised)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {grouped[status].length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                {grouped[status].map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className="cursor-grab active:cursor-grabbing transition-transform"
                    style={{
                      opacity: draggingTaskId === task.id ? 0.4 : 1,
                    }}
                  >
                    <TaskCard
                      task={task}
                      onClick={() => openTaskModal(task)}
                    />
                  </div>
                ))}

                {/* Empty state for drop zone */}
                {grouped[status].length === 0 && (
                  <div
                    className="flex-1 min-h-[80px] flex items-center justify-center rounded-lg text-[12px]"
                    style={{
                      color: "var(--text-muted)",
                      border: isDropTarget ? "none" : "1px dashed var(--border-default)",
                    }}
                  >
                    {isDropTarget ? "Buraya bırak" : isFiltered ? "Filtre sonucu yok" : "Görev yok"}
                  </div>
                )}
              </div>

              {/* Add button */}
              {status !== "done" && (
                <button
                  onClick={() => handleAddTask(status)}
                  className="flex items-center justify-center gap-1.5 mt-3 py-2 rounded-lg text-[12px] transition-colors shrink-0"
                  style={{
                    border: "1px dashed var(--border-strong)",
                    color: "var(--text-tertiary)",
                    background: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--surface-raised)";
                    e.currentTarget.style.borderColor = "var(--brand-gold)";
                    e.currentTarget.style.color = "var(--brand-gold)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "var(--border-strong)";
                    e.currentTarget.style.color = "var(--text-tertiary)";
                  }}
                >
                  <Plus size={13} />
                  Yeni görev ekle
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
