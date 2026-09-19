"use client";

import type { Task } from "@/types";
import { getPriorityLabel, cn } from "@/lib/utils";
import { minutesToDisplay } from "@/lib/dates";
import { Clock, CheckSquare, Check, Star } from "lucide-react";

interface TaskCardProps {
  task: Task;
  compact?: boolean;
  onClick?: () => void;
  onToggle?: () => void;
  onFocus?: () => void;
  showSchedule?: boolean;
}

const PRIORITY_CLASSES: Record<string, string> = {
  urgent: "cp-priority-urgent",
  high: "cp-priority-high",
  medium: "cp-priority-medium",
  low: "cp-priority-low",
};

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  work: { bg: "var(--tag-work-bg)", color: "#791F1F" },
  personal: { bg: "var(--tag-personal-bg)", color: "#085041" },
  project: { bg: "var(--tag-project-bg)", color: "#3C3489" },
  meeting: { bg: "var(--tag-meeting-bg)", color: "#633806" },
  school: { bg: "var(--tag-school-bg)", color: "var(--tag-school-text)" },
};

export function TaskCard({ task, compact = false, onClick, onToggle, onFocus, showSchedule = false }: TaskCardProps) {
  const completedChecks = task.checklist.filter((c) => c.completed).length;
  const totalChecks = task.checklist.length;
  const isDone = task.status === "done";

  return (
    <div
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "cp-card p-3",
        onClick && "cursor-pointer",
        isDone && "opacity-60"
      )}
    >
      <div className="flex items-start gap-2.5">
        {onToggle && (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onToggle(); }}
            className="w-6 h-6 mt-0.5 rounded-full shrink-0 flex items-center justify-center transition-colors"
            style={{
              border: `1.5px solid ${isDone ? "var(--status-done-text)" : "var(--border-strong)"}`,
              background: isDone ? "var(--status-done-bg)" : "transparent",
              color: "var(--status-done-text)",
            }}
            aria-label={isDone ? "Görevi yeniden aç" : "Görevi tamamla"}
          >
            {isDone && <Check size={14} />}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p
            className={cn("text-[13px] font-medium mb-1.5", isDone && "line-through")}
            style={{ color: "var(--text-primary)" }}
          >
            {task.title}
          </p>

      {/* Meta row */}
          <div className="flex items-center gap-1.5 flex-wrap">
        {/* Priority */}
        <span className={cn("cp-priority", PRIORITY_CLASSES[task.priority])}>
          {getPriorityLabel(task.priority)}
        </span>

        {/* Tags */}
        {task.tags.map((tag) => {
          const style = TAG_STYLES[tag.color] || TAG_STYLES.work;
          return (
            <span
              key={tag.id}
              className="cp-tag"
              style={{ background: style.bg, color: style.color }}
            >
              {tag.name}
            </span>
          );
        })}

        {/* Duration */}
        {task.estimatedMinutes && !compact && (
          <span
            className="flex items-center gap-1 text-[10px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            <Clock size={10} />
            {minutesToDisplay(task.estimatedMinutes)}
          </span>
        )}
            {showSchedule && task.scheduledStartTime && (
              <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                <Clock size={10} />
                {task.scheduledStartTime}{task.scheduledEndTime ? `–${task.scheduledEndTime}` : ""}
              </span>
            )}
          </div>
        </div>
        {onFocus && (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onFocus(); }}
            className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
            style={{ color: task.focusDate ? "var(--brand-gold-hover)" : "var(--text-muted)" }}
            aria-label={task.focusDate ? "Günün odağından çıkar" : "Günün odağına al"}
          >
            <Star size={16} fill={task.focusDate ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      {/* Checklist progress */}
      {totalChecks > 0 && (
        <div
          className="flex items-center gap-2 mt-2 text-[11px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          <CheckSquare size={11} />
          {completedChecks}/{totalChecks}
          <div
            className="flex-1 h-[3px] rounded-full max-w-[60px]"
            style={{ background: "var(--border-default)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(completedChecks / totalChecks) * 100}%`,
                background: "var(--brand-gold)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
