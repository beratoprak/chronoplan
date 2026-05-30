// ============================================================
// ChronoPlan — Core Type Definitions
// ============================================================

import type { User } from "@supabase/supabase-js";

export type ViewType = "daily" | "weekly" | "monthly" | "kanban" | "notes" | "media" | "references" | "research" | "pomodoro";

export type Priority = "urgent" | "high" | "medium" | "low";

export type TaskStatus = "planned" | "active" | "done";

export type TagColor = "work" | "personal" | "project" | "meeting";

// ---- Tag ----
export interface Tag {
  id: string;
  name: string;
  color: TagColor;
}

// ---- Task / Kanban Card ----
export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  tags: Tag[];
  estimatedMinutes?: number;
  checklist: ChecklistItem[];
  date?: string; // ISO date string YYYY-MM-DD — optional (dateless tasks)
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  order: number; // for kanban drag ordering
}

// ---- Rich Note ----
export interface RichNote {
  id: string;
  title: string;
  content: string; // plain text / markdown
  tags: string[]; // free-form tag strings
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---- Media (Books & Movies) ----
export type MediaType = "book" | "movie" | "paper";
export type MediaStatus = "want" | "in_progress" | "done";

export interface MediaItem {
  id: string;
  type: MediaType;
  title: string;
  author?: string; // for books & papers
  director?: string; // for movies
  journal?: string; // for papers
  doi?: string; // for papers
  abstract?: string; // for papers
  year?: number;
  rating?: number; // 1-5
  notes?: string;
  status: MediaStatus;
  createdAt: string;
  updatedAt: string;
}

// ---- Academic Reference ----
export type ReferenceType = "article" | "book" | "chapter" | "thesis" | "conference" | "website" | "other";
export type CitationStyle = "apa" | "chicago" | "ieee" | "mla";

export interface Reference {
  id: string;
  type: ReferenceType;
  title: string;
  authors: string[]; // ["Soyadı, Ad", ...]
  year?: number;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  city?: string;
  doi?: string;
  url?: string;
  isbn?: string;
  abstract?: string;
  notes?: string;
  tags: string[];
  projectId?: string; // linked research project
  createdAt: string;
  updatedAt: string;
}

// ---- Research Project ----
export type ResearchStatus = "planning" | "active" | "writing" | "done";

export interface FieldNote {
  id: string;
  content: string;
  noteType: "observation" | "informative" | "reflection";
  location?: string;
  createdAt: string;
}

export interface ResearchProject {
  id: string;
  title: string;
  question: string; // research question
  hypothesis?: string;
  description?: string;
  status: ResearchStatus;
  tags: string[];
  fieldNotes: FieldNote[];
  referenceIds: string[]; // linked references
  createdAt: string;
  updatedAt: string;
}

// ---- Pomodoro / Time Tracking ----
export type PomodoroPhase = "work" | "short_break" | "long_break";

export interface WorkSession {
  id: string;
  projectId?: string;
  projectLabel: string; // free-form label
  durationMinutes: number;
  phase: PomodoroPhase;
  completedAt: string;
}

export interface PomodoroSettings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
}

// ---- Day Note (Block Editor) ----
export interface DayNote {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  content: string; // BlockNote JSON string
  plainText: string; // extracted plain text for preview
  updatedAt: string;
}

// ---- Calendar Event ----
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  tagColor: TagColor;
  isAllDay: boolean;
  recurrence: RecurrenceType;
  recurrenceEndDate?: string; // YYYY-MM-DD — recurring events stop after this date
}

// ---- Kanban Filter (Faz 6) ----
export interface KanbanFilter {
  priority: Priority | "all";
  tagId: string | "all";
}

// ---- Search Result (Faz 6) ----
export type SearchResultType = "task" | "event" | "note";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  date: string;
}

// ---- App State ----
export interface AppState {
  // Demo mode
  isDemoMode: boolean;
  setDemoMode: (value: boolean) => void;
  demoToast: string | null;
  showDemoToast: (message: string) => void;

  // View
  currentView: ViewType;
  selectedDate: string;
  setView: (view: ViewType) => void;
  setSelectedDate: (date: string) => void;

  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // Task Modal (Faz 3)
  isTaskModalOpen: boolean;
  editingTask: Task | null;
  openTaskModal: (task?: Task) => void;
  closeTaskModal: () => void;

  // Delete Confirm (Faz 3)
  deletingTaskId: string | null;
  openDeleteConfirm: (id: string) => void;
  closeDeleteConfirm: () => void;

  // Tasks
  tasks: Task[];
  addTask: (task: Omit<Task, "id" | "createdAt" | "updatedAt" | "order">) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, status: TaskStatus) => void;
  reorderTask: (id: string, newOrder: number, newStatus?: TaskStatus) => void;

  // Notes
  notes: DayNote[];
  getNote: (date: string) => DayNote | undefined;
  saveNote: (date: string, content: string, plainText: string) => void;

  // Event Modal (Faz 4)
  isEventModalOpen: boolean;
  editingEvent: CalendarEvent | null;
  openEventModal: (event?: CalendarEvent) => void;
  closeEventModal: () => void;

  // Event Delete Confirm (Faz 4)
  deletingEventId: string | null;
  openDeleteEventConfirm: (id: string) => void;
  closeDeleteEventConfirm: () => void;

  // Events
  events: CalendarEvent[];
  addEvent: (event: Omit<CalendarEvent, "id">) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  getExpandedEvents: (startDate: string, endDate: string) => CalendarEvent[];

  // Tags
  tags: Tag[];

  // ── Auth (Faz 5) ──────────────────────────────────────────
  user: User | null;
  authLoading: boolean;
  syncStatus: "idle" | "syncing" | "error";
  initAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  syncFromSupabase: () => Promise<void>;

  // ── Search (Faz 6) ────────────────────────────────────────
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;

  // ── Kanban Filter (Faz 6) ─────────────────────────────────
  kanbanFilter: KanbanFilter;
  setKanbanFilter: (filter: Partial<KanbanFilter>) => void;

  // ── Theme (Faz 7) ───────────────────────────────────────
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  // ── Settings Panel (Faz 7) ──────────────────────────────
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

  // ── Workspace / SaaS (Faz 8) ───────────────────────────
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  setCurrentWorkspace: (workspace: Workspace) => void;
  isWorkspaceModalOpen: boolean;
  openWorkspaceModal: () => void;
  closeWorkspaceModal: () => void;

  // ── Rich Notes ───────────────────────────────────────────
  richNotes: RichNote[];
  addRichNote: (note: Omit<RichNote, "id" | "createdAt" | "updatedAt">) => void;
  updateRichNote: (id: string, updates: Partial<RichNote>) => void;
  deleteRichNote: (id: string) => void;

  // ── Media (Books & Movies) ──────────────────────────────
  mediaItems: MediaItem[];
  addMediaItem: (item: Omit<MediaItem, "id" | "createdAt" | "updatedAt">) => void;
  updateMediaItem: (id: string, updates: Partial<MediaItem>) => void;
  deleteMediaItem: (id: string) => void;

  // ── References ───────────────────────────────────────────
  references: Reference[];
  addReference: (ref: Omit<Reference, "id" | "createdAt" | "updatedAt">) => void;
  updateReference: (id: string, updates: Partial<Reference>) => void;
  deleteReference: (id: string) => void;

  // ── Research Projects ────────────────────────────────────
  researchProjects: ResearchProject[];
  addResearchProject: (proj: Omit<ResearchProject, "id" | "createdAt" | "updatedAt">) => void;
  updateResearchProject: (id: string, updates: Partial<ResearchProject>) => void;
  deleteResearchProject: (id: string) => void;
  addFieldNote: (projectId: string, note: Omit<FieldNote, "id" | "createdAt">) => void;
  deleteFieldNote: (projectId: string, noteId: string) => void;

  // ── Pomodoro / Time Tracking ─────────────────────────────
  workSessions: WorkSession[];
  pomodoroSettings: PomodoroSettings;
  addWorkSession: (session: Omit<WorkSession, "id" | "completedAt">) => void;
  setPomodoroSettings: (settings: Partial<PomodoroSettings>) => void;
}

// ---- Theme (Faz 7) ----
export type ThemeMode = "light" | "dark" | "system";

// ---- Workspace / SaaS (Faz 8) ----
export type WorkspaceRole = "owner" | "admin" | "member";
export type SubscriptionPlan = "free" | "pro" | "team";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";

export interface WorkspaceMember {
  id: string;
  userId: string;
  email: string;
  name?: string;
  role: WorkspaceRole;
  joinedAt: string;
  avatarUrl?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  members: WorkspaceMember[];
  createdAt: string;
  plan: SubscriptionPlan;
  maxMembers: number;
  isPersonal: boolean;
}

export interface Subscription {
  id: string;
  workspaceId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface SharedKanbanBoard {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  isPublic: boolean;
  allowedMembers: string[]; // member IDs
  createdAt: string;
  updatedAt: string;
}

// ---- Utility types ----
export type DateString = string; // YYYY-MM-DD format

export interface DayData {
  date: DateString;
  isToday: boolean;
  isCurrentMonth: boolean;
  hasNote: boolean;
  events: CalendarEvent[];
  tasks: Task[];
}
