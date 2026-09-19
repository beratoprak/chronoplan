"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { addDays, format, parseISO } from "date-fns";
import { CalendarClock, CheckCircle2, Focus, Plus, Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { formatDate } from "@/lib/dates";
import { getTaskDueDate, getTasksForDate } from "@/lib/planner";
import { EventCard } from "@/components/shared/EventCard";
import { TaskCard } from "@/components/shared/TaskCard";

const NoteEditor = dynamic(
  () => import("@/components/editor/NoteEditor").then((m) => m.NoteEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 rounded-2xl min-h-[360px] flex items-center justify-center" style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)" }}>
        <span style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>Editör yükleniyor…</span>
      </div>
    ),
  }
);

export function DailyView() {
  const {
    selectedDate,
    events,
    tasks,
    notes,
    workSessions,
    openEventModal,
    openTaskModal,
    updateTask,
    moveTask,
    getExpandedEvents,
  } = useAppStore();

  const dayEvents = useMemo(
    () => getExpandedEvents(selectedDate, selectedDate).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")),
    [events, selectedDate, getExpandedEvents]
  );
  const dayTasks = useMemo(
    () => Array.from(new Map(tasks
      .filter((task) => getTasksForDate([task], selectedDate).length > 0 || getTaskDueDate(task) === selectedDate || task.focusDate === selectedDate)
      .sort((a, b) => Number(b.focusDate === selectedDate) - Number(a.focusDate === selectedDate) || (a.scheduledStartTime || "99:99").localeCompare(b.scheduledStartTime || "99:99"))
      .map((task) => [task.id, task] as const)).values()),
    [tasks, selectedDate]
  );
  const openTasks = dayTasks.filter((task) => task.status !== "done");
  const completedTasks = dayTasks.filter((task) => task.status === "done");
  const focusTasks = openTasks.filter((task) => task.focusDate === selectedDate).slice(0, 3);
  const focusMinutes = workSessions
    .filter((session) => session.completedAt.slice(0, 10) === selectedDate && session.phase === "work")
    .reduce((sum, session) => sum + session.durationMinutes, 0);
  const dayNote = notes.find((note) => note.date === selectedDate);
  const tomorrow = format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd");
  const tomorrowCount = tasks.filter((task) => getTaskDueDate(task) === tomorrow && task.status !== "done").length;

  const toggleTask = (id: string, done: boolean) => moveTask(id, done ? "active" : "done");
  const toggleFocus = (id: string, active: boolean) => {
    if (!active && focusTasks.length >= 3) return;
    updateTask(id, { focusDate: active ? undefined : selectedDate });
  };

  return (
    <div className="grid gap-5 h-full animate-fade-in grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="flex flex-col gap-3 min-w-0 order-1">
        <div className="rounded-2xl p-4 sm:p-5" style={{ background: "linear-gradient(135deg, var(--brand-gold-light), var(--surface-raised))", border: "1px solid var(--border-default)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[.14em] font-semibold" style={{ color: "var(--brand-gold-hover)" }}>Günün sayfası</p>
              <h2 className="text-[20px] sm:text-[24px] font-semibold mt-1" style={{ color: "var(--text-primary)" }}>{formatDate(selectedDate, "d MMMM, EEEE")}</h2>
            </div>
            <button
              onClick={() => openTaskModal(undefined, { dueDate: selectedDate, scheduledDate: selectedDate })}
              className="cp-btn cp-btn-primary min-h-11 px-3.5 shrink-0"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Görev</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="cp-context-chip"><CalendarClock size={13} /> {dayEvents.length} zaman bloğu</span>
            <span className="cp-context-chip"><CheckCircle2 size={13} /> {completedTasks.length}/{dayTasks.length} görev</span>
            <span className="cp-context-chip"><Focus size={13} /> {focusMinutes} dk odak</span>
            {tomorrowCount > 0 && <span className="cp-context-chip">Yarın {tomorrowCount} son tarih</span>}
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>Günlük not</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>Planın üstündeki düşünme alanın</p>
          </div>
          <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            {dayNote ? `${formatDate(dayNote.updatedAt, "HH:mm")} kaydedildi` : "Otomatik kaydedilir"}
          </span>
        </div>
        <NoteEditor date={selectedDate} />

        <section className="xl:hidden rounded-2xl p-4" style={{ background: "var(--surface-base)", border: "1px solid var(--border-default)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Bugünün akışı</h3>
            <button onClick={() => openEventModal(undefined, { date: selectedDate })} className="text-[12px] font-medium" style={{ color: "var(--brand-gold-hover)" }}>+ Zaman</button>
          </div>
          <DayAgenda date={selectedDate} events={dayEvents} tasks={openTasks} onEvent={openEventModal} onTask={openTaskModal} onToggle={toggleTask} onFocus={toggleFocus} />
        </section>
      </section>

      <aside className="hidden xl:flex flex-col gap-5 order-2 min-w-0">
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="section-eyebrow">Günün odağı</h3>
            <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{focusTasks.length}/3</span>
          </div>
          {focusTasks.length ? (
            <div className="grid gap-2">
              {focusTasks.map((task) => <TaskCard key={task.id} task={task} compact onClick={() => openTaskModal(task)} onToggle={() => toggleTask(task.id, false)} onFocus={() => toggleFocus(task.id, true)} showSchedule />)}
            </div>
          ) : (
            <button onClick={() => openTaskModal(undefined, { dueDate: selectedDate, focusDate: selectedDate })} className="w-full rounded-xl p-4 text-left" style={{ border: "1px dashed var(--border-strong)", color: "var(--text-secondary)" }}>
              <Sparkles size={17} className="mb-2" style={{ color: "var(--brand-gold-hover)" }} />
              <span className="block text-[13px] font-medium">Günün en önemli işini seç</span>
              <span className="block text-[11px] mt-1" style={{ color: "var(--text-tertiary)" }}>En fazla üç görev odağa alınabilir.</span>
            </button>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="section-eyebrow">Program</h3>
            <button onClick={() => openEventModal(undefined, { date: selectedDate })} className="text-[11px] font-medium" style={{ color: "var(--brand-gold-hover)" }}>+ Ekle</button>
          </div>
          <DayAgenda date={selectedDate} events={dayEvents} tasks={openTasks} onEvent={openEventModal} onTask={openTaskModal} onToggle={toggleTask} onFocus={toggleFocus} />
        </section>
      </aside>
    </div>
  );
}

function DayAgenda({
  date,
  events,
  tasks,
  onEvent,
  onTask,
  onToggle,
  onFocus,
}: {
  date: string;
  events: ReturnType<ReturnType<typeof useAppStore.getState>["getExpandedEvents"]>;
  tasks: ReturnType<typeof useAppStore.getState>["tasks"];
  onEvent: ReturnType<typeof useAppStore.getState>["openEventModal"];
  onTask: ReturnType<typeof useAppStore.getState>["openTaskModal"];
  onToggle: (id: string, done: boolean) => void;
  onFocus: (id: string, active: boolean) => void;
}) {
  if (!events.length && !tasks.length) {
    return <p className="rounded-xl py-6 text-center text-[12px]" style={{ background: "var(--surface-sunken)", color: "var(--text-tertiary)" }}>Bugün için henüz bir plan yok.</p>;
  }
  return (
    <div className="grid gap-2">
      {events.map((event) => <EventCard key={event.id} event={event} onClick={() => onEvent(event)} />)}
      {tasks.map((task) => <TaskCard key={task.id} task={task} compact onClick={() => onTask(task)} onToggle={() => onToggle(task.id, false)} onFocus={() => onFocus(task.id, task.focusDate === date)} showSchedule />)}
    </div>
  );
}
