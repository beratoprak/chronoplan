"use client";

import { useMemo } from "react";
import { parseISO, format } from "date-fns";
import { useAppStore } from "@/lib/store";
import { getWeekDays, isTodayDate, WEEKDAY_LABELS_SHORT, DATE_FORMAT } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types";

const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

const TAG_EVENT_STYLES: Record<string, { bg: string; color: string }> = {
  work: { bg: "#FCEBEB", color: "#791F1F" },
  personal: { bg: "#E1F5EE", color: "#085041" },
  project: { bg: "#EEEDFE", color: "#3C3489" },
  meeting: { bg: "#FAEEDA", color: "#633806" },
};

export function WeeklyView() {
  const { selectedDate, events, setSelectedDate, openEventModal, getExpandedEvents } = useAppStore();
  const date = parseISO(selectedDate);
  const weekDays = useMemo(() => getWeekDays(date), [selectedDate]);

  const weekStart = useMemo(() => format(weekDays[0], DATE_FORMAT), [weekDays]);
  const weekEnd = useMemo(() => format(weekDays[weekDays.length - 1], DATE_FORMAT), [weekDays]);

  const expandedEvents = useMemo(
    () => getExpandedEvents(weekStart, weekEnd),
    [events, weekStart, weekEnd, getExpandedEvents]
  );

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    expandedEvents.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [expandedEvents]);

  function getEventForSlot(dateStr: string, hour: string) {
    const dayEvents = eventsByDate[dateStr] || [];
    return dayEvents.find((e) => e.startTime === hour);
  }

  function handleEventClick(e: React.MouseEvent, event: CalendarEvent) {
    e.stopPropagation();
    openEventModal(event);
  }

  return (
    <div className="animate-fade-in overflow-x-auto min-w-0">
      {/* Week header */}
      <div
        className="grid gap-px mb-1"
        style={{ gridTemplateColumns: "56px repeat(7, minmax(100px, 1fr))", minWidth: "756px" }}
      >
        <div />
        {weekDays.map((day) => {
          const dateStr = format(day, DATE_FORMAT);
          const today = isTodayDate(day);
          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className="text-center py-2 rounded-lg transition-colors hover:bg-cream-200"
            >
              <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                {WEEKDAY_LABELS_SHORT[(day.getDay() + 6) % 7]}
              </div>
              <div
                className={cn("text-base font-medium", today && "text-gold-500")}
                style={{ color: today ? "var(--brand-gold)" : "var(--text-secondary)" }}
              >
                {day.getDate()}
              </div>
            </button>
          );
        })}
      </div>

      {/* Time grid */}
      <div
        className="grid gap-px"
        style={{ gridTemplateColumns: "56px repeat(7, minmax(100px, 1fr))", minWidth: "756px" }}
      >
        {HOURS.map((hour) => (
          <>
            <div
              key={`t-${hour}`}
              className="text-[11px] text-right pr-2 h-12 flex items-start"
              style={{ color: "var(--text-tertiary)" }}
            >
              {hour}
            </div>
            {weekDays.map((day) => {
              const dateStr = format(day, DATE_FORMAT);
              const event = getEventForSlot(dateStr, hour);
              const today = isTodayDate(day);

              return (
                <div
                  key={`${dateStr}-${hour}`}
                  className="h-12 relative"
                  style={{
                    borderTop: "0.5px solid var(--border-default)",
                    background: today ? "rgba(160, 130, 92, 0.03)" : "transparent",
                  }}
                >
                  {event && (
                    <button
                      onClick={(e) => handleEventClick(e, event)}
                      className="absolute inset-x-0.5 top-0.5 rounded px-1.5 py-1 text-[11px] font-medium truncate text-left transition-all hover:ring-1 hover:ring-[var(--border-accent)]"
                      style={{
                        height: "calc(100% - 4px)",
                        background: TAG_EVENT_STYLES[event.tagColor]?.bg || "#F5F0E8",
                        color: TAG_EVENT_STYLES[event.tagColor]?.color || "#4A3F2F",
                      }}
                    >
                      {event.title}
                    </button>
                  )}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
