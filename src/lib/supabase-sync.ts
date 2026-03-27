// ============================================================
// ChronoPlan — Supabase Senkronizasyon Katmanı
// Faz 5: Offline-first, background push/pull
// ============================================================

import { supabase } from "./supabase";
import type { Task, DayNote, CalendarEvent, Tag, TaskStatus, Priority, TagColor, RecurrenceType } from "@/types";

// ── DB Row Types (snake_case) ─────────────────────────────────

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  tags: Tag[];
  estimated_minutes: number | null;
  checklist: { id: string; text: string; completed: boolean }[];
  date: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  order: number;
}

interface NoteRow {
  id: string;
  user_id: string;
  date: string;
  content: string;
  plain_text: string;
  updated_at: string;
}

interface EventRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  tag_color: string;
  is_all_day: boolean;
  recurrence: string;
  recurrence_end_date: string | null;
}

interface TagRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
}

// ── Dönüşüm Fonksiyonları ──────────────────────────────────────

function taskToRow(task: Task, userId: string): TaskRow {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority,
    tags: task.tags,
    estimated_minutes: task.estimatedMinutes ?? null,
    checklist: task.checklist,
    date: task.date,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    completed_at: task.completedAt ?? null,
    order: task.order,
  };
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as TaskStatus,
    priority: row.priority as Priority,
    tags: row.tags ?? [],
    estimatedMinutes: row.estimated_minutes ?? undefined,
    checklist: row.checklist ?? [],
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    order: row.order,
  };
}

function noteToRow(note: DayNote, userId: string): NoteRow {
  return {
    id: note.id,
    user_id: userId,
    date: note.date,
    content: note.content,
    plain_text: note.plainText,
    updated_at: note.updatedAt,
  };
}

function rowToNote(row: NoteRow): DayNote {
  return {
    id: row.id,
    date: row.date,
    content: row.content,
    plainText: row.plain_text,
    updatedAt: row.updated_at,
  };
}

function eventToRow(event: CalendarEvent, userId: string): EventRow {
  return {
    id: event.id,
    user_id: userId,
    title: event.title,
    description: event.description ?? null,
    date: event.date,
    start_time: event.startTime ?? null,
    end_time: event.endTime ?? null,
    tag_color: event.tagColor,
    is_all_day: event.isAllDay,
    recurrence: event.recurrence,
    recurrence_end_date: event.recurrenceEndDate ?? null,
  };
}

function rowToEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    date: row.date,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    tagColor: row.tag_color as TagColor,
    isAllDay: row.is_all_day,
    recurrence: row.recurrence as RecurrenceType,
    recurrenceEndDate: row.recurrence_end_date ?? undefined,
  };
}

function tagToRow(tag: Tag, userId: string): TagRow {
  return { id: tag.id, user_id: userId, name: tag.name, color: tag.color };
}

function rowToTag(row: TagRow): Tag {
  return { id: row.id, name: row.name, color: row.color as TagColor };
}

// ── Tüm Veriyi Supabase'den Çek ──────────────────────────────

export async function syncAllFromSupabase(userId: string): Promise<{
  tasks: Task[];
  notes: DayNote[];
  events: CalendarEvent[];
  tags: Tag[];
} | null> {
  const [
    { data: taskRows, error: tasksErr },
    { data: noteRows, error: notesErr },
    { data: eventRows, error: eventsErr },
    { data: tagRows, error: tagsErr },
  ] = await Promise.all([
    supabase.from("tasks").select("*").eq("user_id", userId),
    supabase.from("notes").select("*").eq("user_id", userId),
    supabase.from("events").select("*").eq("user_id", userId),
    supabase.from("tags").select("*").eq("user_id", userId),
  ]);

  if (tasksErr || notesErr || eventsErr || tagsErr) {
    console.error("Supabase sync hatası:", tasksErr || notesErr || eventsErr || tagsErr);
    return null;
  }

  return {
    tasks: (taskRows as TaskRow[]).map(rowToTask),
    notes: (noteRows as NoteRow[]).map(rowToNote),
    events: (eventRows as EventRow[]).map(rowToEvent),
    tags: (tagRows as TagRow[]).map(rowToTag),
  };
}

// ── Görev Push ────────────────────────────────────────────────

export async function pushTask(task: Task, userId: string): Promise<void> {
  const { error } = await supabase.from("tasks").upsert(taskToRow(task, userId));
  if (error) console.error("Görev sync hatası:", error.message);
}

export async function deleteTaskFromSupabase(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) console.error("Görev silme hatası:", error.message);
}

// ── Not Push ──────────────────────────────────────────────────

export async function pushNote(note: DayNote, userId: string): Promise<void> {
  const { error } = await supabase
    .from("notes")
    .upsert(noteToRow(note, userId), { onConflict: "user_id,date" });
  if (error) console.error("Not sync hatası:", error.message);
}

// ── Etkinlik Push ─────────────────────────────────────────────

export async function pushEvent(event: CalendarEvent, userId: string): Promise<void> {
  const { error } = await supabase.from("events").upsert(eventToRow(event, userId));
  if (error) console.error("Etkinlik sync hatası:", error.message);
}

export async function deleteEventFromSupabase(id: string): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) console.error("Etkinlik silme hatası:", error.message);
}

// ── Etiket Push ───────────────────────────────────────────────

export async function pushTags(tags: Tag[], userId: string): Promise<void> {
  const rows = tags.map((t) => tagToRow(t, userId));
  const { error } = await supabase.from("tags").upsert(rows);
  if (error) console.error("Etiket sync hatası:", error.message);
}
