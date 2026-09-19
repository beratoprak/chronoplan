import { describe, expect, it } from "vitest";
import { migratePersistedState } from "./migrations";
import type { Task } from "@/types";

function legacyTask(): Task {
  return {
    id: "legacy",
    title: "Eski kayıt",
    status: "planned",
    priority: "medium",
    tags: [],
    checklist: [{ id: "c1", text: "Korunmalı", completed: false }],
    date: "2026-08-27",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    order: 0,
  };
}

describe("migratePersistedState", () => {
  it("eski date alanını silmeden yeni ajanda alanlarını doldurur", () => {
    const migrated = migratePersistedState({ tasks: [legacyTask()], notes: [{ id: "n1" }] });
    const task = migrated.tasks?.[0];
    expect(task?.date).toBe("2026-08-27");
    expect(task?.dueDate).toBe("2026-08-27");
    expect(task?.scheduledDate).toBe("2026-08-27");
    expect(task?.checklist).toHaveLength(1);
    expect(migrated.notes).toEqual([{ id: "n1" }]);
  });

  it("mevcut yeni alanların üzerine yazmaz", () => {
    const task = legacyTask();
    task.dueDate = "2026-08-30";
    task.scheduledDate = "2026-08-29";
    const migrated = migratePersistedState({ tasks: [task] });
    expect(migrated.tasks?.[0].dueDate).toBe("2026-08-30");
    expect(migrated.tasks?.[0].scheduledDate).toBe("2026-08-29");
  });

  it("mevcut etiketleri koruyup Okul etiketini bir kez ekler", () => {
    const migrated = migratePersistedState({
      tags: [{ id: "tag-work", name: "İş", color: "work" }],
    });
    expect(migrated.tags).toEqual([
      { id: "tag-work", name: "İş", color: "work" },
      { id: "tag-school", name: "Okul", color: "school" },
    ]);
    expect(migratePersistedState(migrated).tags).toHaveLength(2);
  });
});
