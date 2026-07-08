"use client";

import { useAppStore } from "@/lib/store";
import { DailyView } from "./DailyView";
import { WeeklyView } from "./WeeklyView";
import { MonthlyView } from "./MonthlyView";
import { KanbanView } from "./KanbanView";
import { NotesView } from "./NotesView";
import { MediaView } from "./MediaView";
import { PomodoroView } from "./PomodoroView";

export function ViewSwitcher() {
  const { currentView } = useAppStore();

  return (
    <div className="flex-1 p-3 pb-24 sm:p-5 md:pb-5 overflow-y-auto">
      {currentView === "daily" && <DailyView />}
      {currentView === "weekly" && <WeeklyView />}
      {currentView === "monthly" && <MonthlyView />}
      {currentView === "kanban" && <KanbanView />}
      {currentView === "notes" && <NotesView />}
      {currentView === "media" && <MediaView />}
      {currentView === "pomodoro" && <PomodoroView />}
    </div>
  );
}
