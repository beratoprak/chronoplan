import { create } from "zustand";
import { persist } from "zustand/middleware";
import { format, parseISO, addDays, addWeeks, addMonths, isBefore, isEqual } from "date-fns";
import type { AppState, Task, TaskStatus, DayNote, CalendarEvent, Tag, RecurrenceType, KanbanFilter, ThemeMode, Workspace, RichNote, MediaItem, WorkSession, PomodoroSettings, BackupData } from "@/types";
import type { User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import {
  syncAllFromSupabase,
  pushTask,
  pushNote,
  pushEvent,
  pushTags,
  pushRichNote,
  pushMediaItem,
  pushWorkSession,
  pushSoftDelete,
  flushOutbox,
  taskToRow,
  eventToRow,
  richNoteToRow,
  mediaItemToRow,
} from "./supabase-sync";

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const STORAGE_KEY = "epoche-storage";

// Eski anahtarlardan (toprak-storage) yeni anahtara veri taşı.
// Eski kayıt SİLİNMEZ — yedek olarak kalır, veri kaybı imkânsız.
if (typeof window !== "undefined") {
  try {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const legacy = localStorage.getItem("toprak-storage");
      if (legacy) localStorage.setItem(STORAGE_KEY, legacy);
    }
  } catch {
    // localStorage erişilemezse sessizce geç (private mode vb.)
  }
}

const DEFAULT_TAGS: Tag[] = [
  { id: "tag-work", name: "İş", color: "work" },
  { id: "tag-personal", name: "Kişisel", color: "personal" },
  { id: "tag-project", name: "Proje", color: "project" },
  { id: "tag-meeting", name: "Toplantı", color: "meeting" },
];

// ── Generic LWW (last-write-wins) birleştirme ─────────────────
// Tombstone'lar sayesinde bir cihazda silinen kayıt, diğer
// cihazın eski kopyasından geri hortlamaz.
interface Syncable {
  id: string;
  updatedAt?: string;
}

interface MergeResult<T extends Syncable> {
  merged: T[];
  toPush: T[]; // yerel daha yeni → sunucuya gönder
  toSoftDelete: { entity: T; deletedAt: string }[]; // sunucuda hâlâ canlı → sil işaretle
  tombstonesOut: Record<string, string>; // bu tablo için güncel tombstone'lar
}

function mergeEntities<T extends Syncable>(
  local: T[],
  remote: T[],
  remoteDeleted: Record<string, string>,
  tombstones: Record<string, string>,
  prefix: string
): MergeResult<T> {
  const localMap = new Map(local.map((i) => [i.id, i]));
  const remoteMap = new Map(remote.map((i) => [i.id, i]));
  const result: MergeResult<T> = { merged: [], toPush: [], toSoftDelete: [], tombstonesOut: {} };

  const localTombs: Record<string, string> = {};
  for (const [key, ts] of Object.entries(tombstones)) {
    if (key.startsWith(`${prefix}:`)) localTombs[key.slice(prefix.length + 1)] = ts;
  }

  const allIds = new Set([
    ...Array.from(localMap.keys()),
    ...Array.from(remoteMap.keys()),
    ...Object.keys(remoteDeleted),
    ...Object.keys(localTombs),
  ]);

  allIds.forEach((id) => {
    const loc = localMap.get(id);
    const rem = remoteMap.get(id);
    const remDel = remoteDeleted[id];
    const tomb = localTombs[id];

    if (tomb) {
      // Yerelde silinmiş. Silme anından SONRA başka cihazda düzenlendiyse geri getir.
      if (rem && (rem.updatedAt ?? "") > tomb) {
        result.merged.push(rem);
      } else {
        result.tombstonesOut[id] = tomb;
        if (rem) result.toSoftDelete.push({ entity: rem, deletedAt: tomb });
      }
      return;
    }
    if (remDel) {
      // Sunucuda silinmiş. Silme anından SONRA yerelde düzenlendiyse geri getir.
      if (loc && (loc.updatedAt ?? "") > remDel) {
        result.merged.push(loc);
        result.toPush.push(loc);
      } else {
        result.tombstonesOut[id] = remDel;
      }
      return;
    }
    if (loc && rem) {
      if ((loc.updatedAt ?? "") >= (rem.updatedAt ?? "")) {
        result.merged.push(loc);
        if ((loc.updatedAt ?? "") > (rem.updatedAt ?? "")) result.toPush.push(loc);
      } else {
        result.merged.push(rem);
      }
    } else if (loc) {
      result.merged.push(loc);
      result.toPush.push(loc);
    } else if (rem) {
      result.merged.push(rem);
    }
  });

  return result;
}

// 90 günden eski tombstone'ları temizle (sonsuz büyümesin)
function pruneTombstones(tombstones: Record<string, string>): Record<string, string> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const pruned: Record<string, string> = {};
  for (const [key, ts] of Object.entries(tombstones)) {
    if (ts > cutoff) pruned[key] = ts;
  }
  return pruned;
}

// ── Otomatik senkronizasyon tetikleyicileri (bir kez kurulur) ──
let syncListenersRegistered = false;
let lastPullAt = 0;

function registerSyncListeners() {
  if (syncListenersRegistered || typeof window === "undefined") return;
  syncListenersRegistered = true;

  const pull = () => {
    const { user } = useAppStore.getState();
    if (user && Date.now() - lastPullAt > 60_000) {
      void useAppStore.getState().syncFromSupabase();
    }
  };

  // İnternet geri gelince: bekleyen yazmaları gönder + veriyi tazele
  window.addEventListener("online", () => {
    void flushOutbox().then(pull);
  });
  // Sekme/uygulama öne gelince
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void flushOutbox();
      pull();
    }
  });
  // Emniyet: kuyruk her 30 sn'de bir denenir, veri 5 dk'da bir çekilir
  setInterval(() => void flushOutbox(), 30_000);
  setInterval(() => {
    const { user } = useAppStore.getState();
    if (user) void useAppStore.getState().syncFromSupabase();
  }, 5 * 60_000);
}


export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Demo mode
      isDemoMode: false,
      setDemoMode: (value) => set({ isDemoMode: value }),
      demoToast: null,
      showDemoToast: (message) => {
        set({ demoToast: message });
        setTimeout(() => set({ demoToast: null }), 2500);
      },

      // View state
      currentView: "daily",
      selectedDate: format(new Date(), "yyyy-MM-dd"),
      setView: (view) => set({ currentView: view }),
      setSelectedDate: (date) => set({ selectedDate: date }),

      // Sidebar
      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      // ── Task Modal State ──────────────────────────────────────
      isTaskModalOpen: false,
      editingTask: null,
      openTaskModal: (task) => {
        if (get().isDemoMode) { get().showDemoToast("Demo modunda gorev duzenlenemez"); return; }
        set({ isTaskModalOpen: true, editingTask: task ?? null });
      },
      closeTaskModal: () => set({ isTaskModalOpen: false, editingTask: null }),

      // ── Delete Confirm State ──────────────────────────────────
      deletingTaskId: null,
      openDeleteConfirm: (id) => {
        if (get().isDemoMode) { get().showDemoToast("Demo modunda silme yapilamaz"); return; }
        set({ deletingTaskId: id });
      },
      closeDeleteConfirm: () => set({ deletingTaskId: null }),

      // ── Event Modal State ─────────────────────────────────────
      isEventModalOpen: false,
      editingEvent: null,
      openEventModal: (event) => {
        if (get().isDemoMode) { get().showDemoToast("Demo modunda etkinlik duzenlenemez"); return; }
        set({ isEventModalOpen: true, editingEvent: event ?? null });
      },
      closeEventModal: () => set({ isEventModalOpen: false, editingEvent: null }),

      // ── Event Delete Confirm State ────────────────────────────
      deletingEventId: null,
      openDeleteEventConfirm: (id) => {
        if (get().isDemoMode) { get().showDemoToast("Demo modunda silme yapilamaz"); return; }
        set({ deletingEventId: id });
      },
      closeDeleteEventConfirm: () => set({ deletingEventId: null }),

      // ── Auth State (Faz 5) ────────────────────────────────────
      user: null,
      authLoading: true,
      syncStatus: "idle",
      tombstones: {},

      // ── Tam Yedekten Geri Yükleme ─────────────────────────────
      // Yedekteki kayıtlar mevcut veriyle LWW kuralıyla birleştirilir;
      // hiçbir mevcut kayıt yedekteki eski bir kopyayla ezilmez.
      importBackup: (data) => {
        let imported = 0;

        function mergeById<T extends { id: string; updatedAt?: string }>(
          local: T[],
          incoming: T[] | undefined
        ): T[] {
          if (!Array.isArray(incoming)) return local;
          const map = new Map(local.map((i) => [i.id, i]));
          for (const item of incoming) {
            if (!item || typeof item.id !== "string") continue;
            const existing = map.get(item.id);
            if (!existing || (item.updatedAt ?? "") > (existing.updatedAt ?? "")) {
              map.set(item.id, item);
              imported++;
            }
          }
          return Array.from(map.values());
        }

        const s = get();
        const mergedNotes = (() => {
          if (!Array.isArray(data.notes)) return s.notes;
          const map = new Map(s.notes.map((n) => [n.date, n]));
          for (const note of data.notes) {
            if (!note || typeof note.date !== "string") continue;
            const existing = map.get(note.date);
            if (!existing || note.updatedAt > existing.updatedAt) {
              map.set(note.date, note);
              imported++;
            }
          }
          return Array.from(map.values());
        })();

        set({
          tasks: mergeById(s.tasks, data.tasks),
          events: mergeById(s.events, data.events),
          richNotes: mergeById(s.richNotes, data.richNotes),
          mediaItems: mergeById(s.mediaItems, data.mediaItems),
          workSessions: mergeById(s.workSessions, data.workSessions),
          notes: mergedNotes,
          pomodoroSettings: data.pomodoroSettings ?? s.pomodoroSettings,
        });

        // Geri yüklenen her şeyi buluta da gönder
        const { user } = get();
        if (user && isSupabaseConfigured) {
          const st = get();
          for (const t of st.tasks) pushTask(t, user.id);
          for (const n of st.notes) pushNote(n, user.id);
          for (const e of st.events) pushEvent(e, user.id);
          for (const n of st.richNotes) pushRichNote(n, user.id);
          for (const m of st.mediaItems) pushMediaItem(m, user.id);
          for (const ws of st.workSessions) pushWorkSession(ws, user.id);
        }
        return imported;
      },

      initAuth: async () => {
        registerSyncListeners();
        if (!isSupabaseConfigured) {
          set({ authLoading: false });
          return;
        }
        set({ authLoading: true });
        const { data: { session } } = await supabase.auth.getSession();
        set({ user: session?.user ?? null, authLoading: false });

        if (session?.user) {
          await get().syncFromSupabase();
        }

        // Auth state değişikliklerini dinle
        supabase.auth.onAuthStateChange(async (_event, session) => {
          const newUser = session?.user ?? null;
          set({ user: newUser });
          if (newUser) {
            await get().syncFromSupabase();
          }
        });
      },

      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error as Error | null };
      },

      signUp: async (email, password) => {
        const { error } = await supabase.auth.signUp({ email, password });
        return { error: error as Error | null };
      },

      signInWithMagicLink: async (email) => {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        return { error: error as Error | null };
      },

      signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null });
      },

      syncFromSupabase: async () => {
        const { user } = get();
        if (!user || !isSupabaseConfigured) return;

        set({ syncStatus: "syncing" });
        lastPullAt = Date.now();

        // Önce bekleyen yerel yazmaları gönder ki sunucudan eski veri çekmeyelim
        await flushOutbox();

        const data = await syncAllFromSupabase(user.id);
        if (data === null) {
          set({ syncStatus: "error" });
          return;
        }

        const state = get();
        const tombs = state.tombstones ?? {};

        const tasksM = mergeEntities(state.tasks, data.tasks, data.deleted.tasks, tombs, "tasks");
        const eventsM = mergeEntities(state.events, data.events, data.deleted.events, tombs, "events");
        const richM = mergeEntities(state.richNotes, data.richNotes, data.deleted.richNotes, tombs, "rich_notes");
        const mediaM = mergeEntities(state.mediaItems, data.mediaItems, data.deleted.mediaItems, tombs, "media_items");

        // ── Notes merge (tarih anahtarlı, silme yok) ─────────────
        const remoteNoteMap = new Map(data.notes.map((n) => [n.date, n]));
        const localNoteMap = new Map(state.notes.map((n) => [n.date, n]));
        const mergedNotes: DayNote[] = [];
        const notesToPush: DayNote[] = [];
        const allNoteDates = new Set([...Array.from(remoteNoteMap.keys()), ...Array.from(localNoteMap.keys())]);
        allNoteDates.forEach((date) => {
          const remote = remoteNoteMap.get(date);
          const local = localNoteMap.get(date);
          if (remote && local) {
            if (local.updatedAt >= remote.updatedAt) {
              mergedNotes.push(local);
              if (local.updatedAt > remote.updatedAt) notesToPush.push(local);
            } else {
              mergedNotes.push(remote);
            }
          } else if (local) {
            mergedNotes.push(local);
            notesToPush.push(local);
          } else if (remote) {
            mergedNotes.push(remote);
          }
        });

        // ── Work sessions: eklemeli kayıtlar, id bazlı birleşim ──
        const sessionIds = new Set(data.workSessions.map((s) => s.id));
        const localOnlySessions = state.workSessions.filter((s) => !sessionIds.has(s.id));
        const mergedSessions = [...data.workSessions, ...localOnlySessions].sort(
          (a, b) => (a.completedAt < b.completedAt ? 1 : -1)
        );

        // Tombstone'ları yeniden kur (dört tablonun güncel hali)
        const newTombstones: Record<string, string> = {};
        for (const [id, ts] of Object.entries(tasksM.tombstonesOut)) newTombstones[`tasks:${id}`] = ts;
        for (const [id, ts] of Object.entries(eventsM.tombstonesOut)) newTombstones[`events:${id}`] = ts;
        for (const [id, ts] of Object.entries(richM.tombstonesOut)) newTombstones[`rich_notes:${id}`] = ts;
        for (const [id, ts] of Object.entries(mediaM.tombstonesOut)) newTombstones[`media_items:${id}`] = ts;

        set({
          tasks: tasksM.merged,
          notes: mergedNotes,
          events: eventsM.merged,
          richNotes: richM.merged,
          mediaItems: mediaM.merged,
          workSessions: mergedSessions,
          tags: data.tags.length > 0 ? data.tags : state.tags,
          tombstones: pruneTombstones(newTombstones),
          syncStatus: "idle",
        });

        // Yerelde daha yeni olanları sunucuya gönder (outbox üzerinden)
        if (data.tags.length === 0) pushTags(state.tags, user.id);
        for (const t of tasksM.toPush) pushTask(t, user.id);
        for (const n of notesToPush) pushNote(n, user.id);
        for (const e of eventsM.toPush) pushEvent(e, user.id);
        for (const n of richM.toPush) pushRichNote(n, user.id);
        for (const m of mediaM.toPush) pushMediaItem(m, user.id);
        for (const s of localOnlySessions) pushWorkSession(s, user.id);

        // Yerelde silinmiş ama sunucuda hâlâ canlı olanları sil işaretle
        for (const { entity, deletedAt } of tasksM.toSoftDelete)
          pushSoftDelete("tasks", taskToRow(entity, user.id) as unknown as Record<string, unknown>, deletedAt);
        for (const { entity, deletedAt } of eventsM.toSoftDelete)
          pushSoftDelete("events", eventToRow(entity, user.id) as unknown as Record<string, unknown>, deletedAt);
        for (const { entity, deletedAt } of richM.toSoftDelete)
          pushSoftDelete("rich_notes", richNoteToRow(entity, user.id) as unknown as Record<string, unknown>, deletedAt);
        for (const { entity, deletedAt } of mediaM.toSoftDelete)
          pushSoftDelete("media_items", mediaItemToRow(entity, user.id) as unknown as Record<string, unknown>, deletedAt);
      },

      // Tasks
      tasks: [],
      addTask: (taskData) => {
        if (get().isDemoMode) { get().showDemoToast("Demo modunda gorev eklenemez"); return; }
        const newTask: Task = {
          ...taskData,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          order: get().tasks.length,
        };
        set((s) => ({ tasks: [...s.tasks, newTask] }));
        // Background sync
        const { user } = get();
        if (user && isSupabaseConfigured) void pushTask(newTask, user.id);
      },
      updateTask: (id, updates) => {
        if (get().isDemoMode) { get().showDemoToast("Demo modunda duzenleme yapilamaz"); return; }
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
          ),
        }));
        const updatedTask = get().tasks.find((t) => t.id === id);
        const { user } = get();
        if (user && isSupabaseConfigured && updatedTask) void pushTask(updatedTask, user.id);
      },
      deleteTask: (id) => {
        if (get().isDemoMode) { get().showDemoToast("Demo modunda silme yapilamaz"); return; }
        const task = get().tasks.find((t) => t.id === id);
        const deletedAt = new Date().toISOString();
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== id),
          tombstones: { ...s.tombstones, [`tasks:${id}`]: deletedAt },
        }));
        const { user } = get();
        if (user && isSupabaseConfigured && task)
          pushSoftDelete("tasks", taskToRow(task, user.id) as unknown as Record<string, unknown>, deletedAt);
      },
      moveTask: (id, status) => {
        if (get().isDemoMode) { get().showDemoToast("Demo modunda gorev tasinamaz"); return; }
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status,
                  updatedAt: new Date().toISOString(),
                  completedAt: status === "done" ? new Date().toISOString() : undefined,
                }
              : t
          ),
        }));
        const updatedTask = get().tasks.find((t) => t.id === id);
        const { user } = get();
        if (user && isSupabaseConfigured && updatedTask) void pushTask(updatedTask, user.id);
      },
      reorderTask: (id, newOrder, newStatus) => {
        if (get().isDemoMode) { get().showDemoToast("Demo modunda gorev tasinamaz"); return; }
        set((s) => {
          const tasks = [...s.tasks];
          const taskIndex = tasks.findIndex((t) => t.id === id);
          if (taskIndex === -1) return s;

          const task = { ...tasks[taskIndex], order: newOrder, status: newStatus ?? tasks[taskIndex].status };
          if (newStatus === "done" && tasks[taskIndex].status !== "done") {
            task.completedAt = new Date().toISOString();
          } else if (newStatus && newStatus !== "done") {
            task.completedAt = undefined;
          }
          task.updatedAt = new Date().toISOString();
          tasks[taskIndex] = task;

          const siblings = tasks
            .filter((t) => t.status === task.status && t.id !== id)
            .sort((a, b) => a.order - b.order);

          siblings.splice(newOrder, 0, task);
          siblings.forEach((t, i) => {
            const idx = tasks.findIndex((x) => x.id === t.id);
            if (idx !== -1) tasks[idx] = { ...tasks[idx], order: i };
          });

          return { tasks };
        });
        // Sync affected tasks
        const { user } = get();
        if (user && isSupabaseConfigured) {
          const updatedTask = get().tasks.find((t) => t.id === id);
          if (updatedTask) void pushTask(updatedTask, user.id);
        }
      },

      // Notes
      notes: [],
      getNote: (date) => get().notes.find((n) => n.date === date),
      saveNote: (date, content, plainText) => {
        if (get().isDemoMode) { get().showDemoToast("Demo modunda not kaydedilemez"); return; }
        set((s) => {
          const existing = s.notes.find((n) => n.date === date);
          if (existing) {
            return {
              notes: s.notes.map((n) =>
                n.date === date
                  ? { ...n, content, plainText, updatedAt: new Date().toISOString() }
                  : n
              ),
            };
          }
          return {
            notes: [
              ...s.notes,
              {
                id: generateId(),
                date,
                content,
                plainText,
                updatedAt: new Date().toISOString(),
              },
            ],
          };
        });
        // Background sync
        const note = get().notes.find((n) => n.date === date);
        const { user } = get();
        if (user && isSupabaseConfigured && note) void pushNote(note, user.id);
      },

      // Events
      events: [],
      addEvent: (eventData) => {
        if (get().isDemoMode) { get().showDemoToast("Demo modunda etkinlik eklenemez"); return; }
        const newEvent = { ...eventData, id: generateId(), updatedAt: new Date().toISOString() };
        set((s) => ({ events: [...s.events, newEvent] }));
        const { user } = get();
        if (user && isSupabaseConfigured) pushEvent(newEvent, user.id);
      },
      updateEvent: (id, updates) => {
        if (get().isDemoMode) { get().showDemoToast("Demo modunda duzenleme yapilamaz"); return; }
        set((s) => ({
          events: s.events.map((e) =>
            e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
          ),
        }));
        const updatedEvent = get().events.find((e) => e.id === id);
        const { user } = get();
        if (user && isSupabaseConfigured && updatedEvent) pushEvent(updatedEvent, user.id);
      },
      deleteEvent: (id) => {
        if (get().isDemoMode) { get().showDemoToast("Demo modunda silme yapilamaz"); return; }
        const event = get().events.find((e) => e.id === id);
        const deletedAt = new Date().toISOString();
        set((s) => ({
          events: s.events.filter((e) => e.id !== id),
          tombstones: { ...s.tombstones, [`events:${id}`]: deletedAt },
        }));
        const { user } = get();
        if (user && isSupabaseConfigured && event)
          pushSoftDelete("events", eventToRow(event, user.id) as unknown as Record<string, unknown>, deletedAt);
      },
      getExpandedEvents: (startDate: string, endDate: string) => {
        const events = get().events;
        const result: CalendarEvent[] = [];
        const start = parseISO(startDate);
        const end = parseISO(endDate);

        for (const event of events) {
          if (event.recurrence === "none" || !event.recurrence) {
            if (event.date >= startDate && event.date <= endDate) {
              result.push(event);
            }
          } else {
            const eventStart = parseISO(event.date);
            const recEnd = event.recurrenceEndDate ? parseISO(event.recurrenceEndDate) : end;
            const effectiveEnd = isBefore(recEnd, end) ? recEnd : end;
            let current = eventStart;

            while (isBefore(current, start) && (isBefore(current, effectiveEnd) || isEqual(current, effectiveEnd))) {
              if (event.recurrence === "daily") current = addDays(current, 1);
              else if (event.recurrence === "weekly") current = addWeeks(current, 1);
              else if (event.recurrence === "monthly") current = addMonths(current, 1);
            }

            let safety = 0;
            while ((isBefore(current, effectiveEnd) || isEqual(current, effectiveEnd)) && safety < 366) {
              const dateStr = format(current, "yyyy-MM-dd");
              result.push({
                ...event,
                id: `${event.id}-${dateStr}`,
                date: dateStr,
              });
              if (event.recurrence === "daily") current = addDays(current, 1);
              else if (event.recurrence === "weekly") current = addWeeks(current, 1);
              else if (event.recurrence === "monthly") current = addMonths(current, 1);
              safety++;
            }
          }
        }
        return result;
      },

      // Tags
      tags: DEFAULT_TAGS,

      // ── Search State (Faz 6) ──────────────────────────────────
      isSearchOpen: false,
      openSearch: () => set({ isSearchOpen: true }),
      closeSearch: () => set({ isSearchOpen: false }),

      // ── Kanban Filter State (Faz 6) ───────────────────────────
      kanbanFilter: { priority: "all", tagId: "all" },
      setKanbanFilter: (filter) =>
        set((s) => ({ kanbanFilter: { ...s.kanbanFilter, ...filter } })),

      // ── Theme (Faz 7) ────────────────────────────────────────
      theme: "light" as ThemeMode,
      setTheme: (newTheme) => {
        set({ theme: newTheme });
        // Immediately apply to DOM (don't wait for React re-render)
        if (typeof document !== "undefined") {
          const resolved =
            newTheme === "system"
              ? window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light"
              : newTheme;
          document.documentElement.setAttribute("data-theme", resolved);
        }
      },

      // ── Settings Panel (Faz 7) ───────────────────────────────
      isSettingsOpen: false,
      openSettings: () => set({ isSettingsOpen: true }),
      closeSettings: () => set({ isSettingsOpen: false }),

      // ── Workspace / SaaS (Faz 8) ────────────────────────────
      currentWorkspace: null,
      workspaces: [],
      setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
      isWorkspaceModalOpen: false,
      openWorkspaceModal: () => set({ isWorkspaceModalOpen: true }),
      closeWorkspaceModal: () => set({ isWorkspaceModalOpen: false }),

      // ── Rich Notes ────────────────────────────────────────
      richNotes: [],
      addRichNote: (note) => {
        const newNote = {
          ...note,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ richNotes: [newNote, ...s.richNotes] }));
        const { user } = get();
        if (user && isSupabaseConfigured) pushRichNote(newNote, user.id);
      },
      updateRichNote: (id, updates) => {
        set((s) => ({
          richNotes: s.richNotes.map((n) =>
            n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
          ),
        }));
        const updated = get().richNotes.find((n) => n.id === id);
        const { user } = get();
        if (user && isSupabaseConfigured && updated) pushRichNote(updated, user.id);
      },
      deleteRichNote: (id) => {
        const note = get().richNotes.find((n) => n.id === id);
        const deletedAt = new Date().toISOString();
        set((s) => ({
          richNotes: s.richNotes.filter((n) => n.id !== id),
          tombstones: { ...s.tombstones, [`rich_notes:${id}`]: deletedAt },
        }));
        const { user } = get();
        if (user && isSupabaseConfigured && note)
          pushSoftDelete("rich_notes", richNoteToRow(note, user.id) as unknown as Record<string, unknown>, deletedAt);
      },

      // ── Media ────────────────────────────────────────────
      mediaItems: [],
      addMediaItem: (item) => {
        const newItem = {
          ...item,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ mediaItems: [newItem, ...s.mediaItems] }));
        const { user } = get();
        if (user && isSupabaseConfigured) pushMediaItem(newItem, user.id);
      },
      updateMediaItem: (id, updates) => {
        set((s) => ({
          mediaItems: s.mediaItems.map((m) =>
            m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
          ),
        }));
        const updated = get().mediaItems.find((m) => m.id === id);
        const { user } = get();
        if (user && isSupabaseConfigured && updated) pushMediaItem(updated, user.id);
      },
      deleteMediaItem: (id) => {
        const item = get().mediaItems.find((m) => m.id === id);
        const deletedAt = new Date().toISOString();
        set((s) => ({
          mediaItems: s.mediaItems.filter((m) => m.id !== id),
          tombstones: { ...s.tombstones, [`media_items:${id}`]: deletedAt },
        }));
        const { user } = get();
        if (user && isSupabaseConfigured && item)
          pushSoftDelete("media_items", mediaItemToRow(item, user.id) as unknown as Record<string, unknown>, deletedAt);
      },

      // ── Pomodoro / Time Tracking ──────────────────────────
      workSessions: [],
      pomodoroSettings: { workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLongBreak: 4 },
      addWorkSession: (session) => {
        const newSession: WorkSession = { ...session, id: generateId(), completedAt: new Date().toISOString() };
        set((s) => ({ workSessions: [newSession, ...s.workSessions] }));
        const { user } = get();
        if (user && isSupabaseConfigured) pushWorkSession(newSession, user.id);
      },
      setPomodoroSettings: (settings) =>
        set((s) => ({ pomodoroSettings: { ...s.pomodoroSettings, ...settings } })),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        tasks: state.tasks,
        notes: state.notes,
        events: state.events,
        tags: state.tags,
        currentView: state.currentView,
        theme: state.theme,
        richNotes: state.richNotes,
        mediaItems: state.mediaItems,
        workSessions: state.workSessions,
        pomodoroSettings: state.pomodoroSettings,
        tombstones: state.tombstones,
      }),
      onRehydrateStorage: () => () => {
        useAppStore.setState({ selectedDate: format(new Date(), "yyyy-MM-dd") });

        // Mobilde sidebar kapalı başlasın (ekranı kaplamasın)
        if (typeof window !== "undefined" && window.innerWidth < 1024) {
          useAppStore.setState({ sidebarOpen: false });
        }

        // Uygulama açık kalırken gün değişimini yakala
        const checkDateChange = () => {
          const today = format(new Date(), "yyyy-MM-dd");
          const current = useAppStore.getState().selectedDate;
          if (current !== today) {
            useAppStore.setState({ selectedDate: today });
          }
        };

        // Pencere odak aldığında kontrol et
        window.addEventListener("focus", checkDateChange);
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) checkDateChange();
        });

        // Her dakika kontrol et (gece yarısı geçişi için)
        setInterval(checkDateChange, 60000);
      },
    }
  )
);
