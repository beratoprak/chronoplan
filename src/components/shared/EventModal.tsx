"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Trash2,
  Calendar,
  Clock,
  Palette,
  Repeat,
  AlignLeft,
  CalendarDays,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn, getTagColorLabel, getRecurrenceLabel } from "@/lib/utils";
import type { TagColor, RecurrenceType } from "@/types";

// ── Constants ────────────────────────────────────────────────

const TAG_COLORS: { value: TagColor; label: string; dot: string; bg: string }[] = [
  { value: "work", label: "İş", dot: "var(--tag-work)", bg: "var(--tag-work-bg)" },
  { value: "personal", label: "Kişisel", dot: "var(--tag-personal)", bg: "var(--tag-personal-bg)" },
  { value: "project", label: "Proje", dot: "var(--tag-project)", bg: "var(--tag-project-bg)" },
  { value: "meeting", label: "Toplantı", dot: "var(--tag-meeting)", bg: "var(--tag-meeting-bg)" },
];

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: "none", label: "Tekrar yok" },
  { value: "daily", label: "Her gün" },
  { value: "weekly", label: "Her hafta" },
  { value: "monthly", label: "Her ay" },
];

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  }
}

// ── EventModal Component ──────────────────────────────────────

export function EventModal() {
  const {
    isEventModalOpen,
    editingEvent,
    closeEventModal,
    addEvent,
    updateEvent,
    selectedDate,
    openDeleteEventConfirm,
  } = useAppStore();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(selectedDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [tagColor, setTagColor] = useState<TagColor>("work");
  const [isAllDay, setIsAllDay] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");

  const titleRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const isEditing = !!editingEvent;

  // ── Populate form on edit ──────────────────────────────────
  useEffect(() => {
    if (isEventModalOpen) {
      if (editingEvent) {
        setTitle(editingEvent.title);
        setDescription(editingEvent.description || "");
        setDate(editingEvent.date);
        setStartTime(editingEvent.startTime || "09:00");
        setEndTime(editingEvent.endTime || "10:00");
        setTagColor(editingEvent.tagColor);
        setIsAllDay(editingEvent.isAllDay);
        setRecurrence(editingEvent.recurrence || "none");
        setRecurrenceEndDate(editingEvent.recurrenceEndDate || "");
      } else {
        setTitle("");
        setDescription("");
        setDate(selectedDate);
        setStartTime("09:00");
        setEndTime("10:00");
        setTagColor("work");
        setIsAllDay(false);
        setRecurrence("none");
        setRecurrenceEndDate("");
      }

      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [isEventModalOpen, editingEvent, selectedDate]);

  // ── Escape key ────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isEventModalOpen) {
        closeEventModal();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEventModalOpen, closeEventModal]);

  // ── Overlay click ──────────────────────────────────────────
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) {
      closeEventModal();
    }
  }

  // ── Submit ─────────────────────────────────────────────────
  function handleSubmit() {
    if (!title.trim()) {
      titleRef.current?.focus();
      return;
    }

    const eventData = {
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      startTime: isAllDay ? undefined : startTime,
      endTime: isAllDay ? undefined : endTime,
      tagColor,
      isAllDay,
      recurrence,
      recurrenceEndDate: recurrence !== "none" && recurrenceEndDate ? recurrenceEndDate : undefined,
    };

    if (isEditing && editingEvent) {
      // For recurring event occurrences (virtual IDs contain "-"), update the original
      const originalId = editingEvent.id.includes("-20")
        ? editingEvent.id.split("-").slice(0, -1).join("-").replace(/-\d{2}-\d{2}$/, "")
        : editingEvent.id;
      // Simpler: find the real event ID (without date suffix)
      const realId = editingEvent.id.replace(/-\d{4}-\d{2}-\d{2}$/, "");
      updateEvent(realId || editingEvent.id, eventData);
    } else {
      addEvent(eventData);
    }

    closeEventModal();
  }

  // ── Delete trigger ─────────────────────────────────────────
  function handleDelete() {
    if (editingEvent) {
      const realId = editingEvent.id.replace(/-\d{4}-\d{2}-\d{2}$/, "");
      closeEventModal();
      openDeleteEventConfirm(realId || editingEvent.id);
    }
  }

  // ── Keyboard submit ────────────────────────────────────────
  function handleFormKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  if (!isEventModalOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--surface-overlay)" }}
    >
      <div
        onKeyDown={handleFormKeyDown}
        className="w-full max-w-[480px] rounded-2xl animate-modal-in"
        style={{
          background: "var(--surface-raised)",
          border: "0.5px solid var(--border-default)",
          boxShadow: "0 25px 50px -12px rgba(44, 37, 24, 0.25)",
        }}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            borderBottom: "0.5px solid var(--border-default)",
            borderRadius: "16px 16px 0 0",
          }}
        >
          <h3
            className="text-[15px] font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {isEditing ? "Etkinliği Düzenle" : "Yeni Etkinlik"}
          </h3>
          <div className="flex items-center gap-1">
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                style={{ color: "var(--text-tertiary)" }}
                title="Etkinliği sil"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={closeEventModal}
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
          style={{ maxHeight: "70vh", overflowY: "auto" }}
        >
          {/* Title */}
          <div>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Etkinlik başlığı..."
              className="w-full text-[15px] font-medium outline-none placeholder:text-[var(--text-muted)]"
              style={{ color: "var(--text-primary)", background: "transparent" }}
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <AlignLeft size={14} style={{ color: "var(--text-tertiary)" }} />
              <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>Açıklama</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Açıklama ekle (opsiyonel)..."
              rows={2}
              className="w-full text-[13px] outline-none resize-none placeholder:text-[var(--text-muted)]"
              style={{ color: "var(--text-secondary)", background: "transparent" }}
            />
          </div>

          {/* ── Properties Grid ───────────────────────────── */}
          <div
            className="rounded-xl"
            style={{ border: "0.5px solid var(--border-default)" }}
          >
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
                style={{ color: "var(--text-primary)", background: "transparent", border: "none" }}
              />
            </div>

            {/* All Day Toggle */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: "0.5px solid var(--border-subtle)" }}
            >
              <CalendarDays size={14} style={{ color: "var(--text-tertiary)" }} />
              <span className="text-[12px] w-20 shrink-0" style={{ color: "var(--text-tertiary)" }}>
                Tüm gün
              </span>
              <button
                type="button"
                onClick={() => setIsAllDay(!isAllDay)}
                className="relative w-9 h-5 rounded-full transition-colors"
                style={{
                  background: isAllDay ? "var(--brand-gold)" : "var(--border-strong)",
                }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
                  style={{
                    background: "var(--surface-raised)",
                    left: isAllDay ? "18px" : "2px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  }}
                />
              </button>
            </div>

            {/* Time Range */}
            {!isAllDay && (
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: "0.5px solid var(--border-subtle)" }}
              >
                <Clock size={14} style={{ color: "var(--text-tertiary)" }} />
                <span className="text-[12px] w-20 shrink-0" style={{ color: "var(--text-tertiary)" }}>
                  Saat
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      // Auto-adjust end time if needed
                      if (e.target.value >= endTime) {
                        const idx = TIME_OPTIONS.indexOf(e.target.value);
                        if (idx >= 0 && idx + 4 < TIME_OPTIONS.length) {
                          setEndTime(TIME_OPTIONS[idx + 4]);
                        }
                      }
                    }}
                    className="text-[12px] font-medium outline-none cursor-pointer rounded-md px-2 py-1"
                    style={{
                      color: "var(--text-primary)",
                      background: "var(--surface-sunken)",
                      border: "0.5px solid var(--border-default)",
                    }}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>—</span>
                  <select
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="text-[12px] font-medium outline-none cursor-pointer rounded-md px-2 py-1"
                    style={{
                      color: "var(--text-primary)",
                      background: "var(--surface-sunken)",
                      border: "0.5px solid var(--border-default)",
                    }}
                  >
                    {TIME_OPTIONS.filter((t) => t > startTime).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Tag Color */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: "0.5px solid var(--border-subtle)" }}
            >
              <Palette size={14} style={{ color: "var(--text-tertiary)" }} />
              <span className="text-[12px] w-20 shrink-0" style={{ color: "var(--text-tertiary)" }}>
                Kategori
              </span>
              <div className="flex gap-1.5 flex-1">
                {TAG_COLORS.map((tc) => (
                  <button
                    type="button"
                    key={tc.value}
                    onClick={() => setTagColor(tc.value)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                      tagColor === tc.value ? "ring-1" : "opacity-40 hover:opacity-70"
                    )}
                    style={{
                      background: tagColor === tc.value ? tc.bg : "transparent",
                      color: tagColor === tc.value ? undefined : "var(--text-tertiary)",
                      ...(tagColor === tc.value ? { outline: `1px solid ${tc.dot}` } : {}),
                    }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: tc.dot }}
                    />
                    {tc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recurrence */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{
                borderBottom: recurrence !== "none" ? "0.5px solid var(--border-subtle)" : "none",
              }}
            >
              <Repeat size={14} style={{ color: "var(--text-tertiary)" }} />
              <span className="text-[12px] w-20 shrink-0" style={{ color: "var(--text-tertiary)" }}>
                Tekrar
              </span>
              <div className="flex gap-1.5 flex-1 flex-wrap">
                {RECURRENCE_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setRecurrence(opt.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                      recurrence === opt.value
                        ? "ring-1"
                        : "opacity-40 hover:opacity-70"
                    )}
                    style={{
                      background: recurrence === opt.value ? "var(--brand-gold-light)" : "transparent",
                      color: recurrence === opt.value ? "var(--brand-gold-hover)" : "var(--text-tertiary)",
                      ...(recurrence === opt.value ? { outline: "1px solid var(--brand-gold)" } : {}),
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recurrence End Date */}
            {recurrence !== "none" && (
              <div className="flex items-center gap-3 px-4 py-3">
                <Calendar size={14} style={{ color: "var(--text-tertiary)" }} />
                <span className="text-[12px] w-20 shrink-0" style={{ color: "var(--text-tertiary)" }}>
                  Bitiş tarihi
                </span>
                <input
                  type="date"
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  min={date}
                  className="text-[12px] font-medium outline-none cursor-pointer"
                  style={{ color: "var(--text-primary)", background: "transparent", border: "none" }}
                />
                {recurrenceEndDate && (
                  <button
                    type="button"
                    onClick={() => setRecurrenceEndDate("")}
                    className="text-[10px] px-2 py-0.5 rounded-md transition-colors hover:bg-[var(--surface-sunken)]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Temizle
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{
            borderTop: "0.5px solid var(--border-default)",
            borderRadius: "0 0 16px 16px",
          }}
        >
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            ⌘ Enter ile kaydet
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeEventModal}
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
