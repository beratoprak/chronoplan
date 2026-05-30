"use client";

import { useAppStore } from "@/lib/store";
import { DailyView } from "./DailyView";
import { WeeklyView } from "./WeeklyView";
import { MonthlyView } from "./MonthlyView";
import { KanbanView } from "./KanbanView";
import { NotesView } from "./NotesView";
import { MediaView } from "./MediaView";
import { ReferencesView } from "./ReferencesView";
import { ResearchView } from "./ResearchView";
import { PomodoroView } from "./PomodoroView";

export function ViewSwitcher() {
  const { currentView } = useAppStore();

  return (
    <div className="flex-1 p-5 overflow-y-auto">
      {currentView === "daily" && <DailyView />}
      {currentView === "weekly" && <WeeklyView />}
      {currentView === "monthly" && <MonthlyView />}
      {currentView === "kanban" && <KanbanView />}
      {currentView === "notes" && <NotesView />}
      {currentView === "references" && <ReferencesView />}
      {currentView === "research" && <ResearchView />}
      {currentView === "media" && <MediaView />}
      {currentView === "pomodoro" && <PomodoroView />}
    </div>
  );
}
