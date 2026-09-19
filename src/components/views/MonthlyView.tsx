"use client";

import { useMemo } from "react";
import { parseISO, format } from "date-fns";
import { useAppStore } from "@/lib/store";
import {
  getMonthDays,
  isTodayDate,
  isSameMonthDate,
  WEEKDAY_LABELS_SHORT,
  DATE_FORMAT,
} from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getTasksForDate } from "@/lib/planner";
import { FileText } from "lucide-react";
import type { CalendarEvent } from "@/types";

// Tema değişkenleri: açık modda pastel, koyu modda Apple Takvim tarzı doygun
const TAG_EVENT_STYLES: Record<string, { bg: string; color: string }> = {
  work: { bg: "var(--tag-work-bg)", color: "var(--tag-work-text)" },
  personal: { bg: "var(--tag-personal-bg)", color: "var(--tag-personal-text)" },
  project: { bg: "var(--tag-project-bg)", color: "var(--tag-project-text)" },
  meeting: { bg: "var(--tag-meeting-bg)", color: "var(--tag-meeting-text)" },
  school: { bg: "var(--tag-school-bg)", color: "var(--tag-school-text)" },
};

export function MonthlyView() {
  const { selectedDate, setSelectedDate, setView, events, tasks, notes, openEventModal, openTaskModal, getExpandedEvents } = useAppStore();
  const currentDate = parseISO(selectedDate);
  const monthDays = useMemo(() => getMonthDays(currentDate), [selectedDate]);

  const rangeStart = useMemo(() => format(monthDays[0], DATE_FORMAT), [monthDays]);
  const rangeEnd = useMemo(() => format(monthDays[monthDays.length - 1], DATE_FORMAT), [monthDays]);

  const expandedEvents = useMemo(
    () => getExpandedEvents(rangeStart, rangeEnd),
    [events, rangeStart, rangeEnd, getExpandedEvents]
  );

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    expandedEvents.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [expandedEvents]);

  function handleDayClick(dateStr: string) {
    setSelectedDate(dateStr);
    setView("daily");
  }

  function handleEventClick(e: React.MouseEvent, event: CalendarEvent) {
    e.stopPropagation();
    openEventModal(event);
  }

  return (
    <div className="animate-fade-in">
      {/* Grid */}
      <div
        className="grid gap-px rounded-xl overflow-hidden"
        style={{
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          background: "var(--border-default)",
        }}
      >
        {/* Weekday headers */}
        {WEEKDAY_LABELS_SHORT.map((day) => (
          <div
            key={day}
            className="text-center py-2 text-[11px] font-medium"
            style={{
              background: "var(--surface-sunken)",
              color: "var(--text-tertiary)",
            }}
          >
            {day}
          </div>
        ))}

        {/* Day cells */}
        {monthDays.map((day) => {
          const dateStr = format(day, DATE_FORMAT);
          const today = isTodayDate(day);
          const isCurrentMonth = isSameMonthDate(day, currentDate);
          const dayEvents = eventsByDate[dateStr] || [];

          return (
            <div
              key={dateStr}
              onClick={() => handleDayClick(dateStr)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") handleDayClick(dateStr);
              }}
              role="button"
              tabIndex={0}
              className={cn(
                "min-h-[104px] p-1.5 text-left transition-colors cursor-pointer",
                !isCurrentMonth && "opacity-40"
              )}
              style={{
                background: "var(--surface-raised)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-base)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--surface-raised)";
              }}
            >
              {/* Day number */}
              <div className="mb-1 flex items-center justify-between">
                {today ? (
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-medium"
                    style={{
                      background: "var(--brand-gold)",
                      color: "var(--text-inverse)",
                    }}
                  >
                    {day.getDate()}
                  </span>
                ) : (
                  <span
                    className="text-[12px] px-0.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {day.getDate()}
                  </span>
                )}
                {notes.some((note) => note.date === dateStr && note.plainText.trim()) && (
                  <FileText size={11} style={{ color: "var(--brand-gold-hover)" }} aria-label="Bu günde not var" />
                )}
              </div>

              {/* Events */}
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 2).map((event) => {
                  const style = TAG_EVENT_STYLES[event.tagColor] || TAG_EVENT_STYLES.work;
                  return (
                    <div
                      key={event.id}
                      className="text-[10px] px-1.5 py-0.5 rounded truncate transition-all hover:ring-1 hover:ring-[var(--border-accent)] cursor-pointer"
                      style={{ background: style.bg, color: style.color }}
                      onClick={(e) => handleEventClick(e, event)}
                    >
                      {event.title}
                    </div>
                  );
                })}
                {dayEvents.length > 2 && (
                  <span className="text-[10px] px-1" style={{ color: "var(--text-tertiary)" }}>
                    +{dayEvents.length - 2} daha
                  </span>
                )}
                {getTasksForDate(tasks, dateStr).slice(0, Math.max(0, 3 - Math.min(dayEvents.length, 2))).map((task) => (
                  <button
                    key={task.id}
                    onClick={(event) => { event.stopPropagation(); openTaskModal(task); }}
                    className="flex items-center gap-1 w-full text-[10px] px-1.5 py-0.5 rounded text-left"
                    style={{ color: "var(--text-secondary)", background: "var(--surface-sunken)" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `var(--priority-${task.priority})` }} />
                    <span className="truncate">{task.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
