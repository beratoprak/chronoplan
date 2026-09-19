"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Clock3, Plus } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { DATE_FORMAT, getWeekDays, isTodayDate, WEEKDAY_LABELS_SHORT } from "@/lib/dates";
import { getTasksForDate, minutesToTime, taskEndTime, timeToMinutes } from "@/lib/planner";
import type { CalendarEvent, Task } from "@/types";

const HOUR_HEIGHT = 64;
const START_HOUR = 7;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index);

const EVENT_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  work: { bg: "var(--tag-work-bg)", color: "var(--tag-work-text)", border: "var(--tag-work)" },
  personal: { bg: "var(--tag-personal-bg)", color: "var(--tag-personal-text)", border: "var(--tag-personal)" },
  project: { bg: "var(--tag-project-bg)", color: "var(--tag-project-text)", border: "var(--tag-project)" },
  meeting: { bg: "var(--tag-meeting-bg)", color: "var(--tag-meeting-text)", border: "var(--tag-meeting)" },
  school: { bg: "var(--tag-school-bg)", color: "var(--tag-school-text)", border: "var(--tag-school)" },
};

export function WeeklyView() {
  const {
    selectedDate,
    events,
    tasks,
    setSelectedDate,
    setView,
    openEventModal,
    openTaskModal,
    updateTask,
    updateEvent,
    getExpandedEvents,
  } = useAppStore();
  const weekDays = useMemo(() => getWeekDays(parseISO(selectedDate)), [selectedDate]);
  const weekStart = format(weekDays[0], DATE_FORMAT);
  const weekEnd = format(weekDays[6], DATE_FORMAT);
  const expandedEvents = useMemo(() => getExpandedEvents(weekStart, weekEnd), [events, weekStart, weekEnd, getExpandedEvents]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of expandedEvents) map.set(event.date, [...(map.get(event.date) ?? []), event]);
    return map;
  }, [expandedEvents]);

  function openEvent(event: CalendarEvent) {
    const original = events.find((item) => item.id === event.id) ?? events.find((item) => event.id.startsWith(`${item.id}-`));
    openEventModal(original ?? event);
  }

  function dropOnTimeline(event: React.DragEvent, date: string, column: HTMLDivElement) {
    event.preventDefault();
    const bounds = column.getBoundingClientRect();
    const minutes = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, START_HOUR * 60 + Math.round(((event.clientY - bounds.top) / HOUR_HEIGHT) * 4) * 15));
    const startTime = minutesToTime(minutes);
    const taskId = event.dataTransfer.getData("application/x-epoche-task");
    const eventId = event.dataTransfer.getData("application/x-epoche-event");

    if (taskId) {
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return;
      updateTask(taskId, {
        scheduledDate: date,
        scheduledStartTime: startTime,
        scheduledEndTime: taskEndTime({ ...task, scheduledStartTime: startTime, scheduledEndTime: undefined }),
      });
    } else if (eventId) {
      const original = events.find((item) => item.id === eventId);
      if (!original || original.recurrence !== "none") return;
      const originalStart = timeToMinutes(original.startTime) ?? minutes;
      const originalEnd = timeToMinutes(original.endTime) ?? originalStart + 60;
      const duration = Math.max(15, originalEnd - originalStart);
      updateEvent(eventId, { date, startTime, endTime: minutesToTime(minutes + duration) });
    }
  }

  return (
    <div className="animate-fade-in min-w-0">
      <div className="md:hidden grid gap-3">
        {weekDays.map((day) => {
          const date = format(day, DATE_FORMAT);
          const dayEvents = (byDate.get(date) ?? []).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
          const dayTasks = getTasksForDate(tasks, date);
          return (
            <section key={date} className="rounded-2xl p-3.5" style={{ background: isTodayDate(day) ? "var(--brand-gold-light)" : "var(--surface-base)", border: `1px solid ${isTodayDate(day) ? "var(--brand-gold)" : "var(--border-default)"}` }}>
              <button onClick={() => { setSelectedDate(date); setView("daily"); }} className="w-full flex items-center justify-between text-left min-h-11">
                <span>
                  <span className="text-[18px] font-semibold" style={{ color: "var(--text-primary)" }}>{day.getDate()}</span>
                  <span className="text-[12px] ml-2" style={{ color: "var(--text-tertiary)" }}>{WEEKDAY_LABELS_SHORT[(day.getDay() + 6) % 7]}{isTodayDate(day) ? " · Bugün" : ""}</span>
                </span>
                <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{dayEvents.length + dayTasks.length} kayıt</span>
              </button>
              <div className="grid gap-1.5 mt-1">
                {dayEvents.map((item) => <AgendaEvent key={item.id} event={item} onClick={() => openEvent(item)} />)}
                {dayTasks.map((task) => <AgendaTask key={task.id} task={task} onClick={() => openTaskModal(task)} />)}
                {!dayEvents.length && !dayTasks.length && (
                  <button onClick={() => openEventModal(undefined, { date })} className="min-h-11 rounded-xl text-[12px] flex items-center justify-center gap-1.5" style={{ color: "var(--text-tertiary)", background: "var(--surface-sunken)" }}><Plus size={14} /> Plan ekle</button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="hidden md:block overflow-auto rounded-2xl" style={{ border: "1px solid var(--border-default)", background: "var(--surface-base)", maxHeight: "calc(100dvh - 170px)" }}>
        <div className="min-w-[940px]">
          <header className="sticky top-0 z-20 grid bg-[var(--surface-raised)]" style={{ gridTemplateColumns: "64px repeat(7,minmax(120px,1fr))", borderBottom: "1px solid var(--border-default)" }}>
            <div />
            {weekDays.map((day) => {
              const date = format(day, DATE_FORMAT);
              return (
                <button key={date} onClick={() => setSelectedDate(date)} className="min-h-[62px] py-2 text-center" style={{ borderLeft: "1px solid var(--border-subtle)" }}>
                  <span className="block text-[10px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>{WEEKDAY_LABELS_SHORT[(day.getDay() + 6) % 7]}</span>
                  <span className="mt-1 inline-flex w-8 h-8 items-center justify-center rounded-full text-[15px] font-semibold" style={{ color: isTodayDate(day) ? "var(--text-inverse)" : "var(--text-primary)", background: isTodayDate(day) ? "var(--brand-gold)" : "transparent" }}>{day.getDate()}</span>
                </button>
              );
            })}
          </header>

          <div className="grid" style={{ gridTemplateColumns: "64px repeat(7,minmax(120px,1fr))" }}>
            <div className="relative" style={{ height: HOURS.length * HOUR_HEIGHT }}>
              {HOURS.map((hour, index) => <span key={hour} className="absolute right-2 -translate-y-2 text-[10px] tabular-nums" style={{ top: index * HOUR_HEIGHT, color: "var(--text-tertiary)" }}>{String(hour).padStart(2, "0")}:00</span>)}
            </div>
            {weekDays.map((day) => {
              const date = format(day, DATE_FORMAT);
              const timedEvents = (byDate.get(date) ?? []).filter((item) => !item.isAllDay && item.startTime);
              const allDayEvents = (byDate.get(date) ?? []).filter((item) => item.isAllDay || !item.startTime);
              const dayTasks = getTasksForDate(tasks, date);
              return (
                <div key={date} className="relative" style={{ height: HOURS.length * HOUR_HEIGHT, borderLeft: "1px solid var(--border-subtle)" }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => dropOnTimeline(e, date, e.currentTarget)} onClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const bounds = e.currentTarget.getBoundingClientRect();
                  const minutes = START_HOUR * 60 + Math.round(((e.clientY - bounds.top) / HOUR_HEIGHT) * 4) * 15;
                  openEventModal(undefined, { date, startTime: minutesToTime(minutes), endTime: minutesToTime(minutes + 60) });
                }}>
                  {HOURS.map((hour, index) => <div key={hour} className="absolute inset-x-0" style={{ top: index * HOUR_HEIGHT, borderTop: "1px solid var(--border-subtle)" }} />)}
                  {(allDayEvents.length > 0 || dayTasks.some((task) => !task.scheduledStartTime)) && (
                    <div className="absolute z-10 inset-x-1 top-1 grid gap-1 max-h-24 overflow-hidden pointer-events-none">
                      {allDayEvents.slice(0, 2).map((item) => <AgendaEvent key={item.id} event={item} onClick={() => openEvent(item)} compact />)}
                      {dayTasks.filter((task) => !task.scheduledStartTime).slice(0, 2).map((task) => <AgendaTask key={task.id} task={task} onClick={() => openTaskModal(task)} compact />)}
                    </div>
                  )}
                  {timedEvents.map((item) => <TimelineEvent key={item.id} event={item} onClick={() => openEvent(item)} onDragStart={(e) => {
                    const original = events.find((candidate) => candidate.id === item.id) ?? events.find((candidate) => item.id.startsWith(`${candidate.id}-`));
                    if (original?.recurrence === "none") e.dataTransfer.setData("application/x-epoche-event", original.id);
                  }} />)}
                  {dayTasks.filter((task) => task.scheduledStartTime).map((task) => <TimelineTask key={task.id} task={task} onClick={() => openTaskModal(task)} />)}
                  {isTodayDate(day) && <NowLine />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="hidden md:block text-[11px] mt-2" style={{ color: "var(--text-tertiary)" }}>Boş bir saate tıklayarak zaman bloğu oluşturabilir; görevleri ve tekil etkinlikleri sürükleyerek yeniden planlayabilirsiniz.</p>
    </div>
  );
}

function AgendaEvent({ event, onClick, compact = false }: { event: CalendarEvent; onClick: () => void; compact?: boolean }) {
  const style = EVENT_STYLES[event.tagColor] ?? EVENT_STYLES.work;
  return <button onClick={(e) => { e.stopPropagation(); onClick(); }} className={`pointer-events-auto flex items-center gap-2 text-left rounded-lg px-2.5 ${compact ? "min-h-7 text-[10px]" : "min-h-11 text-[12px]"}`} style={{ background: style.bg, color: style.color, borderLeft: `3px solid ${style.border}` }}><span className="font-semibold tabular-nums shrink-0">{event.startTime || "Tüm gün"}</span><span className="font-medium truncate">{event.title}</span></button>;
}

function AgendaTask({ task, onClick, compact = false }: { task: Task; onClick: () => void; compact?: boolean }) {
  return <button draggable onDragStart={(e) => e.dataTransfer.setData("application/x-epoche-task", task.id)} onClick={(e) => { e.stopPropagation(); onClick(); }} className={`pointer-events-auto flex items-center gap-2 text-left rounded-lg px-2.5 ${compact ? "min-h-7 text-[10px]" : "min-h-11 text-[12px]"}`} style={{ background: "var(--surface-sunken)", color: "var(--text-secondary)", borderLeft: `3px solid var(--priority-${task.priority})` }}><span className="font-semibold tabular-nums shrink-0">{task.scheduledStartTime || "Görev"}</span><span className="truncate">{task.title}</span></button>;
}

function TimelineEvent({ event, onClick, onDragStart }: { event: CalendarEvent; onClick: () => void; onDragStart: (e: React.DragEvent<HTMLButtonElement>) => void }) {
  const start = timeToMinutes(event.startTime) ?? START_HOUR * 60;
  const end = Math.max(start + 30, timeToMinutes(event.endTime) ?? start + 60);
  const top = ((start - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(28, ((end - start) / 60) * HOUR_HEIGHT);
  const style = EVENT_STYLES[event.tagColor] ?? EVENT_STYLES.work;
  return <button draggable onDragStart={onDragStart} onClick={(e) => { e.stopPropagation(); onClick(); }} className="absolute z-[5] left-1 right-1 rounded-lg px-2 py-1.5 text-left overflow-hidden shadow-sm" style={{ top, height, background: style.bg, color: style.color, borderLeft: `3px solid ${style.border}` }}><span className="block text-[11px] font-semibold truncate">{event.title}</span><span className="block text-[9px] mt-0.5 tabular-nums opacity-80">{event.startTime}–{event.endTime}</span></button>;
}

function TimelineTask({ task, onClick }: { task: Task; onClick: () => void }) {
  const start = timeToMinutes(task.scheduledStartTime) ?? START_HOUR * 60;
  const end = timeToMinutes(taskEndTime(task)) ?? start + 30;
  const top = ((start - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(28, ((Math.max(end, start + 30) - start) / 60) * HOUR_HEIGHT);
  return <button draggable onDragStart={(e) => e.dataTransfer.setData("application/x-epoche-task", task.id)} onClick={(e) => { e.stopPropagation(); onClick(); }} className="absolute z-[6] left-2 right-2 rounded-lg px-2 py-1.5 text-left overflow-hidden" style={{ top, height, background: "var(--surface-raised)", color: "var(--text-primary)", border: `1px dashed var(--priority-${task.priority})` }}><span className="block text-[10px] font-semibold truncate">{task.title}</span><span className="block text-[9px] mt-0.5 tabular-nums" style={{ color: "var(--text-tertiary)" }}><Clock3 size={9} className="inline mr-1" />{task.scheduledStartTime}</span></button>;
}

function NowLine() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < START_HOUR * 60 || minutes > END_HOUR * 60) return null;
  const top = ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  return <div className="absolute z-10 inset-x-0 h-px pointer-events-none" style={{ top, background: "var(--danger-text)" }}><span className="absolute -left-1 -top-1 w-2 h-2 rounded-full" style={{ background: "var(--danger-text)" }} /></div>;
}
