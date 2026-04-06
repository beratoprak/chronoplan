import { create } from "zustand";
import { persist } from "zustand/middleware";
import { format, parseISO, addDays, addWeeks, addMonths, isBefore, isEqual } from "date-fns";
import type { AppState, Task, TaskStatus, DayNote, CalendarEvent, Tag, RecurrenceType, KanbanFilter, ThemeMode, Workspace } from "@/types";
import type { User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import {
  syncAllFromSupabase,
  pushTask,
  pushNote,
  pushEvent,
  pushTags,
  deleteTaskFromSupabase,
  deleteEventFromSupabase,
} from "./supabase-sync";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_TAGS: Tag[] = [
  { id: "tag-work", name: "İş", color: "work" },
  { id: "tag-personal", name: "Kişisel", color: "personal" },
  { id: "tag-project", name: "Proje", color: "project" },
  { id: "tag-meeting", name: "Toplantı", color: "meeting" },
];

// Demo data for initial experience
const DEMO_TASKS: Task[] = [
  {
    id: "demo-1",
    title: "Müşteri teklifi güncelleme",
    status: "active",
    priority: "urgent",
    tags: [DEFAULT_TAGS[0]],
    estimatedMinutes: 60,
    checklist: [
      { id: "c1", text: "Fiyat listesini güncelle", completed: true },
      { id: "c2", text: "PDF oluştur", completed: true },
      { id: "c3", text: "Mail ile gönder", completed: true },
      { id: "c4", text: "Onay bekle", completed: false },
    ],
    date: format(new Date(), "yyyy-MM-dd"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    order: 0,
  },
  {
    id: "demo-2",
    title: "Katalog v2 tasarımı",
    status: "planned",
    priority: "high",
    tags: [DEFAULT_TAGS[2]],
    estimatedMinutes: 180,
    checklist: [
      { id: "c5", text: "Wireframe hazırla", completed: true },
      { id: "c6", text: "Renk paleti belirle", completed: true },
      { id: "c7", text: "Komponent tasarımları", completed: false },
      { id: "c8", text: "Responsive kontrol", completed: false },
      { id: "c9", text: "Final review", completed: false },
    ],
    date: format(new Date(), "yyyy-MM-dd"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    order: 1,
  },
  {
    id: "demo-3",
    title: "ToprakExtension Phase 2",
    status: "active",
    priority: "high",
    tags: [DEFAULT_TAGS[2]],
    estimatedMinutes: 300,
    checklist: [
      { id: "c10", text: "eBay API entegrasyonu", completed: false },
      { id: "c11", text: "Fiyat karşılaştırma", completed: false },
    ],
    date: format(new Date(), "yyyy-MM-dd"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    order: 2,
  },
  {
    id: "demo-4",
    title: "Kargo takip kontrolü",
    status: "done",
    priority: "low",
    tags: [DEFAULT_TAGS[0]],
    checklist: [],
    date: format(new Date(), "yyyy-MM-dd"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    order: 0,
  },
  {
    id: "demo-5",
    title: "Haftalık rapor hazırla",
    status: "active",
    priority: "medium",
    tags: [DEFAULT_TAGS[0]],
    estimatedMinutes: 45,
    checklist: [],
    date: format(new Date(), "yyyy-MM-dd"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    order: 3,
  },
  {
    id: "demo-6",
    title: "SEO optimizasyonu",
    status: "planned",
    priority: "medium",
    tags: [DEFAULT_TAGS[0]],
    estimatedMinutes: 120,
    checklist: [],
    date: format(new Date(), "yyyy-MM-dd"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    order: 4,
  },
  {
    id: "demo-7",
    title: "Fatura ödeme takibi",
    status: "planned",
    priority: "medium",
    tags: [DEFAULT_TAGS[0]],
    estimatedMinutes: 30,
    date: format(new Date(), "yyyy-MM-dd"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    checklist: [],
    order: 5,
  },
];

const DEMO_EVENTS: CalendarEvent[] = [
  {
    id: "ev-1",
    title: "Müşteri görüşmesi",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "10:00",
    endTime: "11:00",
    tagColor: "work",
    isAllDay: false,
    recurrence: "none",
  },
  {
    id: "ev-2",
    title: "Takım toplantısı",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "14:00",
    endTime: "14:30",
    tagColor: "meeting",
    isAllDay: false,
    recurrence: "weekly",
  },
  {
    id: "ev-3",
    title: "Stüdyo fotoğraflar teslim",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "15:00",
    endTime: undefined,
    tagColor: "personal",
    isAllDay: false,
    recurrence: "none",
  },
  {
    id: "ev-4",
    title: "Sprint review",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "17:00",
    endTime: "17:30",
    tagColor: "project",
    isAllDay: false,
    recurrence: "weekly",
  },
];

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

      initAuth: async () => {
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
        const data = await syncAllFromSupabase(user.id);

        if (data === null) {
          set({ syncStatus: "error" });
          return;
        }

        const state = get();

        // ── Tasks merge: updatedAt karşılaştır, local-only'leri push et ──
        const remoteTaskMap = new Map(data.tasks.map((t) => [t.id, t]));
        const localTaskMap = new Map(state.tasks.map((t) => [t.id, t]));
        const mergedTasks: Task[] = [];
        const tasksToPush: Task[] = [];

        const allTaskIds = Array.from(new Set(Array.from(remoteTaskMap.keys()).concat(Array.from(localTaskMap.keys()))));
        allTaskIds.forEach((id) => {
          const remote = remoteTaskMap.get(id);
          const local = localTaskMap.get(id);
          if (remote && local) {
            if (local.updatedAt >= remote.updatedAt) {
              mergedTasks.push(local);
              if (local.updatedAt > remote.updatedAt) tasksToPush.push(local);
            } else {
              mergedTasks.push(remote);
            }
          } else if (local) {
            mergedTasks.push(local);
            tasksToPush.push(local);
          } else if (remote) {
            mergedTasks.push(remote);
          }
        });

        // ── Notes merge ───────────────────────────────────────────
        const remoteNoteMap = new Map(data.notes.map((n) => [n.date, n]));
        const localNoteMap = new Map(state.notes.map((n) => [n.date, n]));
        const mergedNotes: DayNote[] = [];
        const notesToPush: DayNote[] = [];

        const allNoteDates = Array.from(new Set(Array.from(remoteNoteMap.keys()).concat(Array.from(localNoteMap.keys()))));
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

        // ── Events merge ──────────────────────────────────────────
        const remoteEventMap = new Map(data.events.map((e) => [e.id, e]));
        const localEventMap = new Map(state.events.map((e) => [e.id, e]));
        const mergedEvents: CalendarEvent[] = [];
        const eventsToPush: CalendarEvent[] = [];

        const allEventIds = Array.from(new Set(Array.from(remoteEventMap.keys()).concat(Array.from(localEventMap.keys()))));
        allEventIds.forEach((id) => {
          const remote = remoteEventMap.get(id);
          const local = localEventMap.get(id);
          if (remote && local) {
            mergedEvents.push(remote);
          } else if (local) {
            mergedEvents.push(local);
            eventsToPush.push(local);
          } else if (remote) {
            mergedEvents.push(remote);
          }
        });

        // State güncelle
        set({
          tasks: mergedTasks,
          notes: mergedNotes,
          events: mergedEvents,
          tags: data.tags.length > 0 ? data.tags : state.tags,
          syncStatus: "idle",
        });

        // Local-only verileri arka planda Supabase'e push et
        if (data.tags.length === 0) void pushTags(state.tags, user.id);
        for (const t of tasksToPush) void pushTask(t, user.id);
        for (const n of notesToPush) void pushNote(n, user.id);
        for (const e of eventsToPush) void pushEvent(e, user.id);
      },

      // Tasks
      tasks: DEMO_TASKS,
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
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
        const { user } = get();
        if (user && isSupabaseConfigured) void deleteTaskFromSupabase(id);
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
      events: DEMO_EVENTS,
      addEvent: (eventData) => {
        if (get().isDemoMode) { get().showDemoToast("Demo modunda etkinlik eklenemez"); return; }
        const newEvent = { ...eventData, id: generateId() };
        set((s) => ({ events: [...s.events, newEvent] }));
        const { user } = get();
        if (user && isSupabaseConfigured) void pushEvent(newEvent, user.id);
      },
      updateEvent: (id, updates) => {
        if (get().isDemoMode) { get().showDemoToast("Demo modunda duzenleme yapilamaz"); return; }
        set((s) => ({
          events: s.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        }));
        const updatedEvent = get().events.find((e) => e.id === id);
        const { user } = get();
        if (user && isSupabaseConfigured && updatedEvent) void pushEvent(updatedEvent, user.id);
      },
      deleteEvent: (id) => {
        if (get().isDemoMode) { get().showDemoToast("Demo modunda silme yapilamaz"); return; }
        set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
        const { user } = get();
        if (user && isSupabaseConfigured) void deleteEventFromSupabase(id);
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
    }),
    {
      name: "chronoplan-storage",
      partialize: (state) => ({
        tasks: state.tasks,
        notes: state.notes,
        events: state.events,
        tags: state.tags,
        currentView: state.currentView,
        theme: state.theme,
      }),
      onRehydrateStorage: () => () => {
        useAppStore.setState({ selectedDate: format(new Date(), "yyyy-MM-dd") });

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
