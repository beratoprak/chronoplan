"use client";

import { useMemo } from "react";
import { parseISO, format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  getMonthDays,
  isTodayDate,
  isSameMonthDate,
  nextMonth,
  prevMonth,
  WEEKDAY_LABELS_SHORT,
  MONTH_NAMES_TR,
  DATE_FORMAT,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

export function MiniCalendar() {
  const { selectedDate, setSelectedDate, notes, events } = useAppStore();
  const currentDate = parseISO(selectedDate);

  const monthDays = useMemo(() => getMonthDays(currentDate), [selectedDate]);

  const datesWithNotes = useMemo(
    () => new Set(notes.map((n) => n.date)),
    [notes]
  );

  const datesWithEvents = useMemo(
    () => new Set(events.map((e) => e.date)),
    [events]
  );

  function navigateMonth(direction: "prev" | "next") {
    const newDate = direction === "prev" ? prevMonth(currentDate) : nextMonth(currentDate);
    setSelectedDate(format(newDate, DATE_FORMAT));
  }

  return (
    <div className="rounded-lg p-2.5" style={{ background: "var(--surface-raised)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={() => navigateMonth("prev")}
          className="p-0.5 rounded hover:bg-cream-200 transition-colors"
          style={{ color: "var(--text-tertiary)" }}
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {MONTH_NAMES_TR[currentDate.getMonth()]} {currentDate.getFullYear()}
        </span>
        <button
          onClick={() => navigateMonth("next")}
          className="p-0.5 rounded hover:bg-cream-200 transition-colors"
          style={{ color: "var(--text-tertiary)" }}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px text-center mb-1">
        {WEEKDAY_LABELS_SHORT.map((day) => (
          <div
            key={day}
            className="text-[9px] py-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-px text-center">
        {monthDays.map((day) => {
          const dateStr = format(day, DATE_FORMAT);
          const isSelected = dateStr === selectedDate;
          const today = isTodayDate(day);
          const isCurrentMonth = isSameMonthDate(day, currentDate);
          const hasIndicator = datesWithNotes.has(dateStr) || datesWithEvents.has(dateStr);

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={cn(
                "relative text-[11px] py-1 rounded transition-colors",
                !isCurrentMonth && "opacity-40",
                isSelected && !today && "bg-cream-300",
                today && "font-medium",
                !isSelected && !today && "hover:bg-cream-200"
              )}
              style={{
                color: today
                  ? "var(--text-inverse)"
                  : isSelected
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
                background: today ? "var(--brand-gold)" : undefined,
              }}
            >
              {day.getDate()}
              {hasIndicator && !today && (
                <span
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full"
                  style={{ background: "var(--brand-gold)" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
