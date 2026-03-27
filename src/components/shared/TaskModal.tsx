"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import {
  X,
  Plus,
  Trash2,
  GripVertical,
  Clock,
  Calendar,
  Flag,
  Tag,
  CheckSquare,
  AlertCircle,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn, getPriorityLabel } from "@/lib/utils";
import type { Priority, TaskStatus, TagColor, ChecklistItem, Tag as TagType } from "@/types";

// ── Constants ────────────────────────────────────────────────

const PRIORITIES: { value: Priority; label: string; className: string }[] = [
  { value: "urgent", label: "Acil", className: "cp-priority-urgent" },
  { value: "high", label: "Yüksek", className: "cp-priority-high" },
  { value: "medium", label: "Orta", className: "cp-priority-medium" },
  { value: "low", label: "Düşük", className: "cp-priority-low" },
];

const STATUSES: { value: TaskStatus; label: string; dotColor: string }[] = [
  { value: "planned", label: "Planlanan", dotColor: "var(--status-planned-text)" },
  { value: "active", label: "Devam Eden", dotColor: "var(--status-active-text)" },
  { value: "done", label: "Tamamlanan", dotColor: "var(--status-done-text)" },
];

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180, 240];

function generateChecklistId(): string {
  return `cl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── TaskModal Component ──────────────────────────────────────

export function TaskModal() {
  const {
    isTaskModalOpen,
    editingTask,
    closeTaskModal,
    addTask,
    updateTask,
    selectedDate,
    tags: availableTags,
    openDeleteConfirm,
  } = useAppStore();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<TaskStatus>("planned");
  const [selectedTags, setSelectedTags] = useState<TagType[]>([]);
  const [date, setDate] = useState(selectedDate);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | undefined>(undefined);
  const [customMinutes, setCustomMinutes] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const checkInputRef = useRef<HTMLInputElement>(null);
  const durationRef = useRef<HTMLDivElement>(null);

  const isEditing = !!editingTask;

  // ── Populate form on edit ──────────────────────────────────
  useEffect(() => {
    if (isTaskModalOpen) {
      if (editingTask) {
        setTitle(editingTask.title);
        setDescription(editingTask.description || "");
        setPriority(editingTask.priority);
        setStatus(editingTask.status);
        setSelectedTags(editingTask.tags);
        setDate(editingTask.date);
        setEstimatedMinutes(editingTask.estimatedMinutes);
        setCustomMinutes(editingTask.estimatedMinutes?.toString() || "");
        setChecklist(editingTask.checklist.map((c) => ({ ...c })));
      } else {
        // Reset for new task
        setTitle("");
        setDescription("");
        setPriority("medium");
        setStatus("planned");
        setSelectedTags([]);
        setDate(selectedDate);
        setEstimatedMinutes(undefined);
        setCustomMinutes("");
        setChecklist([]);
      }
      setNewCheckItem("");
      setShowTagPicker(false);
      setShowDurationPicker(false);

      // Focus title after mount
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [isTaskModalOpen, editingTask, selectedDate]);

  // ── Escape key to close ────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isTaskModalOpen) {
        if (showDurationPicker) {
          setShowDurationPicker(false);
        } else {
          closeTaskModal();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTaskModalOpen, closeTaskModal, showDurationPicker]);

  // ── Click outside duration picker to close it ──────────────
  useEffect(() => {
    if (!showDurationPicker) return;
    function handleClick(e: MouseEvent) {
      if (durationRef.current && !durationRef.current.contains(e.target as Node)) {
        setShowDurationPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDurationPicker]);

  // ── Overlay click ──────────────────────────────────────────
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) {
      closeTaskModal();
    }
  }

  // ── Tag toggle ─────────────────────────────────────────────
  function toggleTag(tag: TagType) {
    setSelectedTags((prev) =>
      prev.some((t) => t.id === tag.id) ? prev.filter((t) => t.id !== tag.id) : [...prev, tag]
    );
  }

  // ── Duration ───────────────────────────────────────────────
  function selectDuration(minutes: number) {
    setEstimatedMinutes(minutes);
    setCustomMinutes(minutes.toString());
    setShowDurationPicker(false);
  }

  function handleCustomMinutes(val: string) {
    setCustomMinutes(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      setEstimatedMinutes(num);
    } else if (val === "") {
      setEstimatedMinutes(undefined);
    }
  }

  // ── Checklist ──────────────────────────────────────────────
  function addCheckItem() {
    const text = newCheckItem.trim();
    if (!text) return;
    setChecklist((prev) => [...prev, { id: generateChecklistId(), text, completed: false }]);
    setNewCheckItem("");
    setTimeout(() => checkInputRef.current?.focus(), 50);
  }

  function toggleCheckItem(id: string) {
    setChecklist((prev) =>
      prev.map((c) => (c.id === id ? { ...c, completed: !c.completed } : c))
    );
  }

  function removeCheckItem(id: string) {
    setChecklist((prev) => prev.filter((c) => c.id !== id));
  }

  function handleCheckKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addCheckItem();
    }
  }

  // ── Submit ─────────────────────────────────────────────────
  function handleSubmit() {
    if (!title.trim()) {
      titleRef.current?.focus();
      return;
    }

    if (isEditing && editingTask) {
      updateTask(editingTask.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        tags: selectedTags,
        date,
        estimatedMinutes,
        checklist,
        completedAt: status === "done" && editingTask.status !== "done"
          ? new Date().toISOString()
          : status !== "done"
            ? undefined
            : editingTask.completedAt,
      });
    } else {
      addTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        tags: selectedTags,
        date,
        estimatedMinutes,
        checklist,
      });
    }

    closeTaskModal();
  }

  // ── Delete trigger ─────────────────────────────────────────
  function handleDelete() {
    if (editingTask) {
      closeTaskModal();
      openDeleteConfirm(editingTask.id);
    }
  }

  // ── Keyboard submit ────────────────────────────────────────
  function handleFormKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  if (!isTaskModalOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--surface-overlay)" }}
    >
      <div
        onKeyDown={handleFormKeyDown}
        className="w-full max-w-[520px] rounded-2xl animate-modal-in"
        style={{
          background: "var(--surface-raised)",
          border: "0.5px solid var(--border-default)",
          boxShadow: "0 25px 50px -12px rgba(44, 37, 24, 0.25)",
          overflow: "visible",
        }}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            borderBottom: "0.5px solid var(--border-default)",
            borderRadius: "16px 16px 0 0",
            background: "var(--surface-raised)",
          }}
        >
          <h3
            className="text-[15px] font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {isEditing ? "Görevi Düzenle" : "Yeni Görev"}
          </h3>
          <div className="flex items-center gap-1">
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                style={{ color: "var(--text-tertiary)" }}
                title="Görevi sil"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={closeTaskModal}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-tertiary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-sunken)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div
          className="px-5 py-4 space-y-4"
          style={{
            maxHeight: "70vh",
            overflowY: "auto",
            overflowX: "visible",
            background: "var(--surface-raised)",
          }}
        >
          {/* Title */}
          <div>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Görev başlığı..."
              className="w-full text-[15px] font-medium outline-none placeholder:text-[var(--text-muted)]"
              style={{
                color: "var(--text-primary)",
                background: "transparent",
              }}
            />
          </div>

          {/* Description */}
          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Açıklama ekle (opsiyonel)..."
              rows={2}
              className="w-full text-[13px] outline-none resize-none placeholder:text-[var(--text-muted)]"
              style={{
                color: "var(--text-secondary)",
                background: "transparent",
              }}
            />
          </div>

          {/* ── Properties Grid ───────────────────────────── */}
          <div
            className="rounded-xl"
            style={{
              border: "0.5px solid var(--border-default)",
              overflow: "visible",
            }}
          >
            {/* Status (only in edit mode) */}
            {isEditing && (
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: "0.5px solid var(--border-subtle)" }}
              >
                <AlertCircle size={14} style={{ color: "var(--text-tertiary)" }} />
                <span className="text-[12px] w-20 shrink-0" style={{ color: "var(--text-tertiary)" }}>
                  Durum
                </span>
                <div className="flex gap-1.5 flex-1">
                  {STATUSES.map((s) => (
                    <button
                      type="button"
                      key={s.value}
                      onClick={() => setStatus(s.value)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                        status === s.value ? "ring-1" : "opacity-50 hover:opacity-80"
                      )}
                      style={{
                        background: status === s.value
                          ? `var(--status-${s.value}-bg)`
                          : "transparent",
                        color: `var(--status-${s.value}-text)`,
                        ...(status === s.value ? { outline: `1px solid ${s.dotColor}` } : {}),
                      }}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: s.dotColor }}
                      />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Priority */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: "0.5px solid var(--border-subtle)" }}
            >
              <Flag size={14} style={{ color: "var(--text-tertiary)" }} />
              <span className="text-[12px] w-20 shrink-0" style={{ color: "var(--text-tertiary)" }}>
                Öncelik
              </span>
              <div className="flex gap-1.5 flex-1">
                {PRIORITIES.map((p) => (
                  <button
                    type="button"
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      "cp-priority transition-all",
                      p.className,
                      priority === p.value ? "ring-1 ring-current" : "opacity-40 hover:opacity-70"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: "0.5px solid var(--border-subtle)" }}
            >
              <Tag size={14} style={{ color: "var(--text-tertiary)" }} />
              <span className="text-[12px] w-20 shrink-0" style={{ color: "var(--text-tertiary)" }}>
                Etiketler
              </span>
              <div className="flex gap-1.5 flex-1 flex-wrap">
                {availableTags.map((tag) => {
                  const isSelected = selectedTags.some((t) => t.id === tag.id);
                  return (
                    <button
                      type="button"
                      key={tag.id}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "cp-tag transition-all cursor-pointer",
                        isSelected ? "ring-1 ring-current" : "opacity-40 hover:opacity-70"
                      )}
                      style={{
                        background: `var(--tag-${tag.color}-bg)`,
                        color: isSelected ? undefined : "var(--text-tertiary)",
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: "0.5px solid var(--border-subtle)" }}
            >
              <Calendar size={14} style={{ color: "var(--text-tertiary)" }} />
              <span className="text-[12px] w-20 shrink-0" style={{ color: "var(--text-tertiary)" }}>
                Tarih
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-[12px] font-medium outline-none cursor-pointer"
                style={{
                  color: "var(--text-primary)",
                  background: "transparent",
                  border: "none",
                }}
              />
            </div>

            {/* Estimated Duration */}
            <div
              ref={durationRef}
              className="flex items-center gap-3 px-4 py-3 relative"
            >
              <Clock size={14} style={{ color: "var(--text-tertiary)" }} />
              <span className="text-[12px] w-20 shrink-0" style={{ color: "var(--text-tertiary)" }}>
                Süre
              </span>
              <div className="flex-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDurationPicker(!showDurationPicker);
                  }}
                  className="text-[12px] font-medium transition-colors"
                  style={{ color: estimatedMinutes ? "var(--text-primary)" : "var(--text-muted)" }}
                >
                  {estimatedMinutes
                    ? estimatedMinutes >= 60
                      ? `${Math.floor(estimatedMinutes / 60)}sa ${estimatedMinutes % 60 ? `${estimatedMinutes % 60}dk` : ""}`
                      : `${estimatedMinutes}dk`
                    : "Süre ekle..."}
                </button>
              </div>

              {/* Duration Dropdown — positioned relative to the row, renders OUTSIDE overflow */}
              {showDurationPicker && (
                <div
                  className="absolute left-16 bottom-full mb-2 rounded-xl p-3 z-[100] min-w-[240px]"
                  style={{
                    background: "var(--surface-raised)",
                    border: "0.5px solid var(--border-default)",
                    boxShadow: "0 8px 24px rgba(44, 37, 24, 0.15)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p
                    className="text-[11px] font-medium mb-2"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Tahmini süre seç
                  </p>
                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {DURATION_PRESETS.map((min) => (
                      <button
                        type="button"
                        key={min}
                        onClick={() => selectDuration(min)}
                        className={cn(
                          "px-2 py-1.5 text-[11px] rounded-md transition-all",
                          estimatedMinutes === min
                            ? "font-medium"
                            : "hover:bg-[var(--surface-sunken)]"
                        )}
                        style={{
                          background: estimatedMinutes === min ? "var(--brand-gold-light)" : "transparent",
                          color: estimatedMinutes === min ? "var(--brand-gold-hover)" : "var(--text-secondary)",
                        }}
                      >
                        {min >= 60 ? `${min / 60}sa` : `${min}dk`}
                      </button>
                    ))}
                  </div>
                  <div
                    className="flex items-center gap-2 pt-2"
                    style={{ borderTop: "0.5px solid var(--border-subtle)" }}
                  >
                    <input
                      type="number"
                      value={customMinutes}
                      onChange={(e) => handleCustomMinutes(e.target.value)}
                      placeholder="Özel (dk)"
                      min={1}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-[11px] px-2 py-1.5 rounded-md outline-none"
                      style={{
                        background: "var(--surface-sunken)",
                        color: "var(--text-primary)",
                        border: "0.5px solid var(--border-default)",
                      }}
                    />
                    {estimatedMinutes && (
                      <button
                        type="button"
                        onClick={() => { setEstimatedMinutes(undefined); setCustomMinutes(""); }}
                        className="text-[11px] shrink-0 px-2 py-1.5 rounded-md transition-colors hover:bg-[var(--surface-sunken)]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Checklist ─────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckSquare size={14} style={{ color: "var(--text-tertiary)" }} />
              <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                Kontrol Listesi
              </span>
              {checklist.length > 0 && (
                <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {checklist.filter((c) => c.completed).length}/{checklist.length}
                </span>
              )}
            </div>

            {/* Existing items */}
            <div className="space-y-1 mb-2">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 group px-2 py-1.5 rounded-lg transition-colors"
                  style={{ background: "transparent" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-sunken)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <button
                    type="button"
                    onClick={() => toggleCheckItem(item.id)}
                    className="w-4 h-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-all"
                    style={{
                      borderColor: item.completed ? "var(--brand-gold)" : "var(--border-strong)",
                      background: item.completed ? "var(--brand-gold)" : "transparent",
                    }}
                  >
                    {item.completed && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="var(--text-inverse)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span
                    className={cn("text-[12px] flex-1", item.completed && "line-through")}
                    style={{
                      color: item.completed ? "var(--text-muted)" : "var(--text-primary)",
                    }}
                  >
                    {item.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCheckItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add item input */}
            <div className="flex items-center gap-2 px-2">
              <Plus size={14} style={{ color: "var(--text-muted)" }} />
              <input
                ref={checkInputRef}
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                onKeyDown={handleCheckKeyDown}
                placeholder="Madde ekle..."
                className="flex-1 text-[12px] outline-none placeholder:text-[var(--text-muted)]"
                style={{ color: "var(--text-primary)", background: "transparent" }}
              />
              {newCheckItem.trim() && (
                <button
                  type="button"
                  onClick={addCheckItem}
                  className="text-[11px] px-2 py-0.5 rounded-md font-medium transition-colors"
                  style={{
                    background: "var(--brand-gold-light)",
                    color: "var(--brand-gold-hover)",
                  }}
                >
                  Ekle
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{
            borderTop: "0.5px solid var(--border-default)",
            borderRadius: "0 0 16px 16px",
            background: "var(--surface-raised)",
          }}
        >
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            ⌘ Enter ile kaydet
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeTaskModal}
              className="cp-btn cp-btn-ghost text-[12px] px-3 py-1.5"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="cp-btn cp-btn-primary text-[12px] px-4 py-1.5"
            >
              {isEditing ? "Kaydet" : "Oluştur"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}