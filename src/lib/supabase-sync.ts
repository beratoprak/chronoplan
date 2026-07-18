// ============================================================
// Epoche — Supabase Senkronizasyon Katmanı
// Offline-first: tüm yazmalar kalıcı outbox kuyruğundan geçer,
// silmeler soft-delete (deleted_at) ile işaretlenir.
// ============================================================

import { supabase } from "./supabase";
import type { Task, DayNote, CalendarEvent, Tag, RichNote, MediaItem, WorkSession, TaskStatus, Priority, TagColor, RecurrenceType, MediaType, MediaStatus, PomodoroPhase } from "@/types";

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
  date: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  order: number;
  deleted_at?: string | null;
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
  created_at?: string | null;
  updated_at?: string;
  deleted_at?: string | null;
}

interface TagRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
}

interface RichNoteRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface MediaItemRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  author: string | null;
  director: string | null;
  journal: string | null;
  doi: string | null;
  abstract: string | null;
  year: number | null;
  rating: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface WorkSessionRow {
  id: string;
  user_id: string;
  project_label: string;
  duration_minutes: number;
  phase: string;
  completed_at: string;
}

// ── Dönüşüm Fonksiyonları ─────────────────────────────────────

export function taskToRow(task: Task, userId: string): TaskRow {
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
    date: task.date ?? null,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    completed_at: task.completedAt ?? null,
    order: task.order,
    deleted_at: null,
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
    date: row.date ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    order: row.order,
  };
}

export function noteToRow(note: DayNote, userId: string): NoteRow {
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

export function eventToRow(event: CalendarEvent, userId: string): EventRow {
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
    created_at: event.createdAt ?? null,
    updated_at: event.updatedAt ?? new Date().toISOString(),
    deleted_at: null,
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
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at || undefined,
  };
}

export function tagToRow(tag: Tag, userId: string): TagRow {
  return { id: tag.id, user_id: userId, name: tag.name, color: tag.color };
}

function rowToTag(row: TagRow): Tag {
  return { id: row.id, name: row.name, color: row.color as TagColor };
}

export function richNoteToRow(note: RichNote, userId: string): RichNoteRow {
  return {
    id: note.id,
    user_id: userId,
    title: note.title,
    content: note.content,
    tags: note.tags,
    pinned: note.pinned,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    deleted_at: null,
  };
}

function rowToRichNote(row: RichNoteRow): RichNote {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags ?? [],
    pinned: row.pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mediaItemToRow(item: MediaItem, userId: string): MediaItemRow {
  return {
    id: item.id,
    user_id: userId,
    type: item.type,
    title: item.title,
    author: item.author ?? null,
    director: item.director ?? null,
    journal: item.journal ?? null,
    doi: item.doi ?? null,
    abstract: item.abstract ?? null,
    year: item.year ?? null,
    rating: item.rating ?? null,
    notes: item.notes ?? null,
    status: item.status,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    deleted_at: null,
  };
}

function rowToMediaItem(row: MediaItemRow): MediaItem {
  return {
    id: row.id,
    type: row.type as MediaType,
    title: row.title,
    author: row.author ?? undefined,
    director: row.director ?? undefined,
    journal: row.journal ?? undefined,
    doi: row.doi ?? undefined,
    abstract: row.abstract ?? undefined,
    year: row.year ?? undefined,
    rating: row.rating ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status as MediaStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function workSessionToRow(session: WorkSession, userId: string): WorkSessionRow {
  return {
    id: session.id,
    user_id: userId,
    project_label: session.projectLabel,
    duration_minutes: session.durationMinutes,
    phase: session.phase,
    completed_at: session.completedAt,
  };
}

function rowToWorkSession(row: WorkSessionRow): WorkSession {
  return {
    id: row.id,
    projectLabel: row.project_label,
    durationMinutes: row.duration_minutes,
    phase: row.phase as PomodoroPhase,
    completedAt: row.completed_at,
  };
}

// ============================================================
// Outbox — kalıcı yazma kuyruğu
// Her upsert önce kuyruğa girer; gönderim başarılı olursa çıkar.
// İnternet yokken ya da tablo henüz oluşturulmamışken hiçbir
// değişiklik kaybolmaz — bağlantı gelince otomatik akar.
// ============================================================

export type SyncTable = "tasks" | "notes" | "events" | "tags" | "rich_notes" | "media_items" | "work_sessions" | "user_settings";

interface OutboxOp {
  key: string; // dedup anahtarı: table:id
  table: SyncTable;
  row: Record<string, unknown>;
  conflict?: string; // upsert onConflict (notes: "user_id,date")
  ts: number;
}

const OUTBOX_KEY = "epoche-outbox";

function readOutbox(): OutboxOp[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]") as OutboxOp[];
  } catch {
    return [];
  }
}

function writeOutbox(ops: OutboxOp[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
  } catch (e) {
    console.error("Outbox yazılamadı:", e);
  }
}

export function outboxSize(): number {
  return readOutbox().length;
}

/** Bir satırı kuyruğa ekle ve hemen göndermeyi dene. */
export function queueUpsert(table: SyncTable, row: Record<string, unknown>, conflict?: string): void {
  const key = conflict ? `${table}:${row.user_id}:${row.date}` : `${table}:${row.id}`;
  const ops = readOutbox().filter((op) => op.key !== key);
  ops.push({ key, table, row, conflict, ts: Date.now() });
  writeOutbox(ops);
  void flushOutbox();
}

/** Migration öncesi eksik kolonları ayıklayıp yeniden dene. */
async function tryUpsert(op: OutboxOp): Promise<boolean> {
  const q = op.conflict ? { onConflict: op.conflict } : undefined;
  const { error } = await supabase.from(op.table).upsert(op.row, q);
  if (!error) return true;

  // Kolon henüz yok (migration çalıştırılmamış) → o kolonlar olmadan gönder
  if (error.code === "PGRST204" || /column/i.test(error.message)) {
    const stripped = { ...op.row };
    delete stripped.deleted_at;
    delete stripped.updated_at;
    if (op.table === "events") delete stripped.created_at;
    // deleted_at'lı bir soft-delete'i kolon yokken göndermek anlamsız — beklet
    if (op.row.deleted_at) return false;
    const { error: err2 } = await supabase.from(op.table).upsert(stripped, q);
    if (!err2) return true;
    console.error(`Sync hatası (${op.table}):`, err2.message);
    return false;
  }

  console.error(`Sync hatası (${op.table}):`, error.message);
  return false;
}

let flushing = false;

/** Kuyruktaki tüm işlemleri göndermeyi dene; başarısızlar kuyrukta kalır. */
export async function flushOutbox(): Promise<void> {
  if (flushing || typeof window === "undefined") return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  flushing = true;
  try {
    const ops = readOutbox();
    if (ops.length === 0) return;
    const remaining: OutboxOp[] = [];
    for (const op of ops) {
      const ok = await tryUpsert(op);
      if (!ok) remaining.push(op);
    }
    writeOutbox(remaining);
  } finally {
    flushing = false;
  }
}

// ============================================================
// Tüm Veriyi Supabase'den Çek
// ============================================================

export interface RemoteData {
  tasks: Task[];
  notes: DayNote[];
  events: CalendarEvent[];
  tags: Tag[];
  richNotes: RichNote[];
  mediaItems: MediaItem[];
  workSessions: WorkSession[];
  // Sunucuda soft-delete edilmiş kayıtlar: id → deleted_at
  deleted: {
    tasks: Record<string, string>;
    events: Record<string, string>;
    richNotes: Record<string, string>;
    mediaItems: Record<string, string>;
  };
}

interface FetchResult<T> {
  rows: T[];
  missing: boolean; // tablo henüz oluşturulmamış
  failed: boolean;
}

async function fetchTable<T>(table: SyncTable, userId: string): Promise<FetchResult<T>> {
  const { data, error } = await supabase.from(table).select("*").eq("user_id", userId);
  if (!error) return { rows: (data ?? []) as T[], missing: false, failed: false };
  // Tablo yok (migration çalıştırılmamış) → boş kabul et, sync'i düşürme
  if (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message)) {
    return { rows: [], missing: true, failed: false };
  }
  console.error(`Supabase okuma hatası (${table}):`, error.message);
  return { rows: [], missing: false, failed: true };
}

function splitDeleted<R extends { id: string; deleted_at?: string | null }>(
  rows: R[]
): { live: R[]; deleted: Record<string, string> } {
  const live: R[] = [];
  const deleted: Record<string, string> = {};
  for (const row of rows) {
    if (row.deleted_at) deleted[row.id] = row.deleted_at;
    else live.push(row);
  }
  return { live, deleted };
}

export async function syncAllFromSupabase(userId: string): Promise<RemoteData | null> {
  const [tasksR, notesR, eventsR, tagsR, richR, mediaR, sessionsR] = await Promise.all([
    fetchTable<TaskRow>("tasks", userId),
    fetchTable<NoteRow>("notes", userId),
    fetchTable<EventRow>("events", userId),
    fetchTable<TagRow>("tags", userId),
    fetchTable<RichNoteRow>("rich_notes", userId),
    fetchTable<MediaItemRow>("media_items", userId),
    fetchTable<WorkSessionRow>("work_sessions", userId),
  ]);

  // Çekirdek tablolar okunamadıysa (ağ hatası vb.) merge yapma —
  // aksi halde yerel veriyi "uzakta yok" sanıp yanlış karar verebiliriz.
  if (tasksR.failed || notesR.failed || eventsR.failed || tagsR.failed) return null;

  const tasks = splitDeleted(tasksR.rows);
  const events = splitDeleted(eventsR.rows);
  const rich = splitDeleted(richR.rows);
  const media = splitDeleted(mediaR.rows);

  return {
    tasks: tasks.live.map(rowToTask),
    notes: notesR.rows.map(rowToNote),
    events: events.live.map(rowToEvent),
    tags: tagsR.rows.map(rowToTag),
    richNotes: rich.live.map(rowToRichNote),
    mediaItems: media.live.map(rowToMediaItem),
    workSessions: sessionsR.rows.map(rowToWorkSession),
    deleted: {
      tasks: tasks.deleted,
      events: events.deleted,
      richNotes: rich.deleted,
      mediaItems: media.deleted,
    },
  };
}

// ============================================================
// Push yardımcıları — hepsi outbox üzerinden
// ============================================================

export function pushTask(task: Task, userId: string): void {
  queueUpsert("tasks", taskToRow(task, userId) as unknown as Record<string, unknown>);
}

export function pushNote(note: DayNote, userId: string): void {
  queueUpsert("notes", noteToRow(note, userId) as unknown as Record<string, unknown>, "user_id,date");
}

export function pushEvent(event: CalendarEvent, userId: string): void {
  queueUpsert("events", eventToRow(event, userId) as unknown as Record<string, unknown>);
}

export function pushTags(tags: Tag[], userId: string): void {
  for (const tag of tags) {
    queueUpsert("tags", tagToRow(tag, userId) as unknown as Record<string, unknown>);
  }
}

export function pushRichNote(note: RichNote, userId: string): void {
  queueUpsert("rich_notes", richNoteToRow(note, userId) as unknown as Record<string, unknown>);
}

export function pushMediaItem(item: MediaItem, userId: string): void {
  queueUpsert("media_items", mediaItemToRow(item, userId) as unknown as Record<string, unknown>);
}

export function pushWorkSession(session: WorkSession, userId: string): void {
  queueUpsert("work_sessions", workSessionToRow(session, userId) as unknown as Record<string, unknown>);
}

export interface UserSettingsRow {
  user_id: string;
  pomodoro: unknown;
  theme: string | null;
  updated_at: string;
}

export function pushUserSettings(row: UserSettingsRow): void {
  queueUpsert("user_settings", row as unknown as Record<string, unknown>);
}

export async function fetchUserSettings(userId: string): Promise<UserSettingsRow | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as UserSettingsRow;
}

// ── Otomatik bulut yedeği ─────────────────────────────────────
// Günde bir kez tüm veri anlık görüntüsü backups tablosuna yazılır.
// Migration v2 çalıştırılmamışsa sessizce atlanır, ertesi denemede tekrar dener.

const LAST_BACKUP_KEY = "epoche-last-cloud-backup";

export async function maybeCloudBackup(userId: string, snapshot: unknown): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const last = Number(localStorage.getItem(LAST_BACKUP_KEY) ?? 0);
    if (Date.now() - last < 24 * 60 * 60 * 1000) return;

    const { error } = await supabase.from("backups").insert({
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      user_id: userId,
      created_at: new Date().toISOString(),
      data: snapshot,
    });
    if (error) return; // tablo yoksa (v2 migration bekleniyor) sessiz geç

    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));

    // 30 günden eski yedekleri temizle
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("backups").delete().eq("user_id", userId).lt("created_at", cutoff);
  } catch {
    // yedek alınamadı — bir sonraki eşitlemede tekrar denenir
  }
}

/** Soft delete: kayıt sunucuda deleted_at ile işaretlenir, asla fiziksel silinmez. */
export function pushSoftDelete(
  table: "tasks" | "events" | "rich_notes" | "media_items",
  row: Record<string, unknown>,
  deletedAt: string
): void {
  queueUpsert(table, { ...row, deleted_at: deletedAt, updated_at: deletedAt });
}
