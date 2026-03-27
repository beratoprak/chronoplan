"use client";

import type { CalendarEvent } from "@/types";
import { formatTimeRange } from "@/lib/dates";
import { Repeat } from "lucide-react";

const TAG_BAR_COLORS: Record<string, string> = {
  work: "var(--tag-work)",
  personal: "var(--tag-personal)",
  project: "var(--tag-project)",
  meeting: "var(--tag-meeting)",
};

interface EventCardProps {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: () => void;
}

export function EventCard({ event, compact = false, onClick }: EventCardProps) {
  const barColor = TAG_BAR_COLORS[event.tagColor] || TAG_BAR_COLORS.work;

  return (
    <div
      onClick={onClick}
      className="flex gap-2 p-2 rounded-lg transition-colors cursor-pointer"
      style={{
        background: "var(--surface-raised)",
        border: "0.5px solid var(--border-default)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-accent)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(107, 91, 62, 0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-default)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        className="w-[3px] rounded-full shrink-0"
        style={{ background: barColor }}
      />
      <div className="min-w-0 flex-1">
        <p
          className="text-[13px] font-medium truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {event.title}
        </p>
        <div className="flex items-center gap-1.5">
          <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            {event.isAllDay ? "Tüm gün" : formatTimeRange(event.startTime, event.endTime)}
          </p>
          {event.recurrence && event.recurrence !== "none" && (
            <Repeat size={10} style={{ color: "var(--text-muted)" }} />
          )}
        </div>
      </div>
    </div>
  );
}
