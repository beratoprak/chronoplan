"use client";
import dynamic from "next/dynamic";

const NoteEditor = dynamic(
  () => import("@/components/editor/NoteEditor").then((m) => m.NoteEditor),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex-1 rounded-lg min-h-[360px] flex items-center justify-center"
        style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)" }}
      >
        <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>Editör yükleniyor...</span>
      </div>
    ),
  }
);
import { useMemo } from "react";
import { parseISO, addDays, format } from "date-fns";
import { useAppStore } from "@/lib/store";
import { formatDate } from "@/lib/dates";
import { EventCard } from "@/components/shared/EventCard";
import { TaskCard } from "@/components/shared/TaskCard";

export function DailyView() {
  const { selectedDate, events, tasks, notes, openEventModal, getExpandedEvents } = useAppStore();
  const date = parseISO(selectedDate);
  void date;

  const dayEvents = useMemo(
    () =>
      getExpandedEvents(selectedDate, selectedDate)
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")),
    [events, selectedDate, getExpandedEvents]
  );

  const dayTasks = useMemo(
    () => tasks.filter((t) => t.date === selectedDate && t.status !== "done"),
    [tasks, selectedDate]
  );

  const upcomingEvents = useMemo(() => {
    const nextWeek = format(addDays(parseISO(selectedDate), 7), "yyyy-MM-dd");
    const tomorrow = format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd");
    return getExpandedEvents(tomorrow, nextWeek)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || "").localeCompare(b.startTime || ""))
      .slice(0, 5);
  }, [events, selectedDate, getExpandedEvents]);

  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.date > selectedDate && t.status !== "done")
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 4),
    [tasks, selectedDate]
  );

  const dayNote = notes.find((n) => n.date === selectedDate);

  return (
    <div className="grid gap-5 h-full animate-fade-in grid-cols-1 lg:grid-cols-[1fr_300px]">
      {/* Left: Note editor area */}
      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
            Günün notları
          </h3>
          <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            {dayNote ? `Son düzenleme: ${formatDate(dayNote.updatedAt, "HH:mm")}` : "Henüz not yok"}
          </span>
        </div>

        <NoteEditor date={selectedDate} />
      </div>

      {/* Right: Schedule + upcoming */}
      <div className="flex flex-col gap-4">
        {/* Today's schedule */}
        <div>
          <h4
            className="text-[11px] font-medium uppercase tracking-wider mb-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            Bugünün programı
          </h4>
          <div className="flex flex-col gap-1.5">
            {dayEvents.length > 0 ? (
              dayEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={() => openEventModal(event)}
                />
              ))
            ) : (
              <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
                Bugün etkinlik yok
              </p>
            )}
          </div>
        </div>

        {/* Upcoming events */}
        {upcomingEvents.length > 0 && (
          <div>
            <h4
              className="text-[11px] font-medium uppercase tracking-wider mb-2"
              style={{ color: "var(--text-tertiary)" }}
            >
              Yaklaşan etkinlikler
            </h4>
            <div className="flex flex-col gap-1.5">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="relative">
                  <span
                    className="absolute top-1 right-1.5 text-[9px] px-1.5 py-0.5 rounded"
                    style={{ color: "var(--text-muted)", background: "var(--surface-sunken)" }}
                  >
                    {formatDate(event.date, "d MMM")}
                  </span>
                  <EventCard
                    event={event}
                    onClick={() => openEventModal(event)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming tasks */}
        <div>
          <h4
            className="text-[11px] font-medium uppercase tracking-wider mb-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            Yaklaşan görevler
          </h4>
          <div className="flex flex-col gap-1.5">
            {dayTasks.length > 0 ? (
              dayTasks.map((task) => (
                <TaskCard key={task.id} task={task} compact />
              ))
            ) : upcomingTasks.length > 0 ? (
              upcomingTasks.map((task) => (
                <TaskCard key={task.id} task={task} compact />
              ))
            ) : (
              <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
                Yaklaşan görev yok
              </p>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div
          className="rounded-lg p-3 mt-auto"
          style={{ background: "var(--surface-sunken)" }}
        >
          <h4
            className="text-[11px] font-medium uppercase tracking-wider mb-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            Günlük özet
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Etkinlik", value: dayEvents.length },
              { label: "Görev", value: dayTasks.length },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-lg font-medium" style={{ color: "var(--brand-gold)" }}>
                  {stat.value}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}