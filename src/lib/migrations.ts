import type { Tag, Task } from "@/types";

type PersistedEpocheState = Record<string, unknown> & { tasks?: Task[]; tags?: Tag[] };

/**
 * Kalıcı depodaki eski kayıtları eklemeli biçimde günceller. `date` alanı
 * korunur; yalnızca yeni ajanda alanları boşsa eski değerden türetilir.
 */
export function migratePersistedState(raw: unknown): PersistedEpocheState {
  const state = raw && typeof raw === "object" ? (raw as PersistedEpocheState) : {};
  const tags = Array.isArray(state.tags) ? [...state.tags] : state.tags;
  if (Array.isArray(tags) && !tags.some((tag) => tag.id === "tag-school" || tag.color === "school")) {
    tags.push({ id: "tag-school", name: "Okul", color: "school" });
  }

  return {
    ...state,
    ...(tags ? { tags } : {}),
    ...(Array.isArray(state.tasks) ? { tasks: state.tasks.map((task) => ({
      ...task,
      dueDate: task.dueDate ?? task.date,
      scheduledDate: task.scheduledDate ?? task.date,
      recurrence: task.recurrence ?? "none",
    })) } : {}),
  };
}
