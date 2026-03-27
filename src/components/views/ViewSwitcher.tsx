"use client";

import { useAppStore } from "@/lib/store";
import { DailyView } from "./DailyView";
import { WeeklyView } from "./WeeklyView";
import { MonthlyView } from "./MonthlyView";
import { KanbanView } from "./KanbanView";

export function ViewSwitcher() {
  const { currentView } = useAppStore();

  return (
    <div className="flex-1 p-5 overflow-y-auto">
      {currentView === "daily" && <DailyView />}
      {currentView === "weekly" && <WeeklyView />}
      {currentView === "monthly" && <MonthlyView />}
      {currentView === "kanban" && <KanbanView />}
    </div>
  );
}
