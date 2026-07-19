"use client";

import { Fragment, useMemo } from "react";
import { parseISO, format } from "date-fns";
import { useAppStore } from "@/lib/store";
import { getWeekDays, isTodayDate, WEEKDAY_LABELS_SHORT, DATE_FORMAT } from "@/lib/dates";
import { buildWeekHours, eventsInSlot, isAllDayOrTimeless, getTasksForDate } from "@/lib/planner";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types";

// Tema değişkenleri: açık modda pastel, koyu modda Apple Takvim tarzı doygun
const TAG_EVENT_STYLES: Record<string, { bg: string; color: string }> = {
  work: { bg: "var(--tag-work-bg)", color: "var(--tag-work-text)" },
  personal: { bg: "var(--tag-personal-bg)", color: "var(--tag-personal-text)" },
  project: { bg: "var(--tag-project-bg)", color: "var(--tag-project-text)" },
  meeting: { bg: "var(--tag-meeting-bg)", color: "var(--tag-meeting-text)" },
};

const GRID_COLS = "56px repeat(7, minmax(100px, 1fr))";

export function WeeklyView() {
  const { selectedDate, events, tasks, setSelectedDate, openEventModal, openTaskModal, getExpandedEvents } = useAppStore();
  const date = parseISO(selectedDate);
  const weekDays = useMemo(() => getWeekDays(date), [selectedDate]);

  const weekStart = useMemo(() => format(weekDays[0], DATE_FORMAT), [weekDays]);
  const weekEnd = useMemo(() => format(weekDays[weekDays.length - 1], DATE_FORMAT), [weekDays]);

  const expandedEvents = useMemo(
    () => getExpandedEvents(weekStart, weekEnd),
    [events, weekStart, weekEnd, getExpandedEvents]
  );

  // Saat aralığı etkinliklere göre otomatik genişler — hiçbir etkinlik kaybolmaz
  const hours = useMemo(() => buildWeekHours(expandedEvents), [expandedEvents]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    expandedEvents.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [expandedEvents]);

  const allDayByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    expandedEvents.filter(isAllDayOrTimeless).forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [expandedEvents]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, ReturnType<typeof getTasksForDate>> = {};
    weekDays.forEach((day) => {
      const dateStr = format(day, DATE_FORMAT);
      map[dateStr] = getTasksForDate(tasks, dateStr);
    });
    return map;
  }, [tasks, weekDays]);

  const hasAllDay = useMemo(
    () => Object.values(allDayByDate).some((list) => list.length > 0),
    [allDayByDate]
  );
  const hasTasks = useMemo(
    () => Object.values(tasksByDate).some((list) => list.length > 0),
    [tasksByDate]
  );

  function handleEventClick(e: React.MouseEvent, event: CalendarEvent) {
    e.stopPropagation();
    // Tekrarlı oluşum id'si "orijinal-YYYY-MM-DD" — düzenleme orijinali açar
    const original = events.find((ev) => ev.id === event.id) ?? events.find((ev) => event.id.startsWith(`${ev.id}-`));
    openEventModal(original ?? event);
  }

  // ── Mobil: ajanda listesi (yatay kaydırma yok) ──────────────
  const agenda = (
    <div className="flex flex-col gap-2 md:hidden animate-fade-in">
      {weekDays.map((day) => {
        const dateStr = format(day, DATE_FORMAT);
        const today = isTodayDate(day);
        const dayEvents = (eventsByDate[dateStr] ?? [])
          .slice()
          .sort((a, b) => (a.isAllDay ? "" : a.startTime ?? "99").localeCompare(b.isAllDay ? "" : b.startTime ?? "99"));
        const dayTasks = tasksByDate[dateStr] ?? [];
        const isEmpty = dayEvents.length === 0 && dayTasks.length === 0;

        return (
          <div
            key={`ag-${dateStr}`}
            className="rounded-xl p-3"
            style={{
              background: today ? "var(--brand-gold-light)" : "var(--surface-base)",
              border: `0.5px solid ${today ? "var(--brand-gold)" : "var(--border-default)"}`,
            }}
          >
            <button
              onClick={() => setSelectedDate(dateStr)}
              className="flex items-baseline gap-2 w-full text-left mb-1"
            >
              <span
                className="text-base font-semibold tabular-nums"
                style={{ color: today ? "var(--brand-gold)" : "var(--text-primary)" }}
              >
                {day.getDate()}
              </span>
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {WEEKDAY_LABELS_SHORT[(day.getDay() + 6) % 7]}
                {today && " · Bugün"}
              </span>
            </button>

            {isEmpty ? (
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Boş
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {dayEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => handleEventClick(e, event)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left min-h-[36px]"
                    style={{
                      background: TAG_EVENT_STYLES[event.tagColor]?.bg || "var(--surface-sunken)",
                      color: TAG_EVENT_STYLES[event.tagColor]?.color || "var(--text-primary)",
                    }}
                  >
                    <span className="text-[11px] font-semibold tabular-nums shrink-0 w-12">
                      {event.isAllDay || !event.startTime ? "Gün" : event.startTime}
                    </span>
                    <span className="text-[13px] font-medium truncate">{event.title}</span>
                  </button>
                ))}
                {dayTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => openTaskModal(task)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left min-h-[36px]"
                    style={{ background: "var(--surface-sunken)" }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0 ml-1 mr-1"
                      style={{ background: `var(--priority-${task.priority})` }}
                    />
                    <span className="text-[13px] truncate" style={{ color: "var(--text-secondary)" }}>
                      {task.title}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {agenda}
      <div className="animate-fade-in overflow-x-auto min-w-0 hidden md:block">
      {/* Week header */}
      <div className="grid gap-px mb-1" style={{ gridTemplateColumns: GRID_COLS, minWidth: "756px" }}>
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

      {/* Tüm gün / saatsiz etkinlikler */}
      {hasAllDay && (
        <div className="grid gap-px mb-1" style={{ gridTemplateColumns: GRID_COLS, minWidth: "756px" }}>
          <div className="text-[10px] text-right pr-2 pt-1" style={{ color: "var(--text-tertiary)" }}>
            Tüm gün
          </div>
          {weekDays.map((day) => {
            const dateStr = format(day, DATE_FORMAT);
            const list = allDayByDate[dateStr] ?? [];
            return (
              <div key={`ad-${dateStr}`} className="flex flex-col gap-0.5 min-h-[4px]">
                {list.map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => handleEventClick(e, event)}
                    className="rounded px-1.5 py-0.5 text-[11px] font-medium truncate text-left transition-all hover:ring-1 hover:ring-[var(--border-accent)]"
                    style={{
                      background: TAG_EVENT_STYLES[event.tagColor]?.bg || "#F5F0E8",
                      color: TAG_EVENT_STYLES[event.tagColor]?.color || "#4A3F2F",
                    }}
                  >
                    {event.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Günün görevleri */}
      {hasTasks && (
        <div
          className="grid gap-px mb-1 pb-1"
          style={{ gridTemplateColumns: GRID_COLS, minWidth: "756px", borderBottom: "0.5px solid var(--border-default)" }}
        >
          <div className="text-[10px] text-right pr-2 pt-1" style={{ color: "var(--text-tertiary)" }}>
            Görevler
          </div>
          {weekDays.map((day) => {
            const dateStr = format(day, DATE_FORMAT);
            const list = tasksByDate[dateStr] ?? [];
            return (
              <div key={`tk-${dateStr}`} className="flex flex-col gap-0.5 min-h-[4px]">
                {list.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => openTaskModal(task)}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] truncate text-left transition-all hover:ring-1 hover:ring-[var(--border-accent)]"
                    style={{ background: "var(--surface-sunken)", color: "var(--text-secondary)" }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: `var(--priority-${task.priority})` }}
                    />
                    <span className="truncate">{task.title}</span>
                  </button>
                ))}
                {list.length > 3 && (
                  <button
                    onClick={() => setSelectedDate(dateStr)}
                    className="text-[10px] text-left px-1.5"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    +{list.length - 3} görev daha
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Time grid */}
      <div className="grid gap-px" style={{ gridTemplateColumns: GRID_COLS, minWidth: "756px" }}>
        {hours.map((hour) => (
          <Fragment key={hour}>
            <div
              className="text-[11px] text-right pr-2 min-h-12 flex items-start"
              style={{ color: "var(--text-tertiary)" }}
            >
              {hour}
            </div>
            {weekDays.map((day) => {
              const dateStr = format(day, DATE_FORMAT);
              const slotEvents = eventsInSlot(eventsByDate[dateStr] ?? [], hour);
              const today = isTodayDate(day);

              return (
                <div
                  key={`${dateStr}-${hour}`}
                  className="min-h-12 flex flex-col gap-0.5 p-0.5"
                  style={{
                    borderTop: "0.5px solid var(--border-default)",
                    background: today ? "rgba(160, 130, 92, 0.03)" : "transparent",
                  }}
                >
                  {slotEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={(e) => handleEventClick(e, event)}
                      className="flex-1 rounded px-1.5 py-1 text-[11px] font-medium text-left transition-all hover:ring-1 hover:ring-[var(--border-accent)] min-h-[22px]"
                      style={{
                        background: TAG_EVENT_STYLES[event.tagColor]?.bg || "#F5F0E8",
                        color: TAG_EVENT_STYLES[event.tagColor]?.color || "#4A3F2F",
                      }}
                    >
                      <span className="block truncate">
                        {event.startTime && event.startTime.slice(3, 5) !== "00" && (
                          <span className="opacity-70 mr-1">{event.startTime}</span>
                        )}
                        {event.title}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </Fragment>
        ))}
        </div>
      </div>
    </>
  );
}
