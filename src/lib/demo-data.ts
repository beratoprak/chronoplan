import { addDays, format } from "date-fns";
import type { CalendarEvent, DayNote, RichNote, Task, WorkSession } from "@/types";

export interface EpocheDemoData {
  tasks: Task[];
  notes: DayNote[];
  events: CalendarEvent[];
  richNotes: RichNote[];
  workSessions: WorkSession[];
}

export function buildDemoData(now = new Date()): EpocheDemoData {
  const today = format(now, "yyyy-MM-dd");
  const tomorrow = format(addDays(now, 1), "yyyy-MM-dd");
  const yesterday = format(addDays(now, -1), "yyyy-MM-dd");
  const stamp = now.toISOString();

  const tasks: Task[] = [
    {
      id: "demo-task-1",
      title: "Proje sunumunun son provasını yap",
      description: "Açılış ve sonuç slaytlarını sadeleştir.",
      status: "active",
      priority: "high",
      tags: [{ id: "tag-project", name: "Proje", color: "project" }],
      estimatedMinutes: 45,
      checklist: [
        { id: "demo-check-1", text: "Süreyi ölç", completed: true },
        { id: "demo-check-2", text: "Son slaytı gözden geçir", completed: false },
      ],
      date: today,
      dueDate: today,
      scheduledDate: today,
      scheduledStartTime: "10:30",
      scheduledEndTime: "11:15",
      focusDate: today,
      recurrence: "none",
      createdAt: stamp,
      updatedAt: stamp,
      order: 0,
    },
    {
      id: "demo-task-2",
      title: "Haftalık planı netleştir",
      status: "planned",
      priority: "medium",
      tags: [{ id: "tag-personal", name: "Kişisel", color: "personal" }],
      estimatedMinutes: 30,
      checklist: [],
      date: today,
      dueDate: today,
      scheduledDate: today,
      scheduledStartTime: "16:00",
      scheduledEndTime: "16:30",
      focusDate: today,
      recurrence: "weekly",
      createdAt: stamp,
      updatedAt: stamp,
      order: 1,
    },
    {
      id: "demo-task-3",
      title: "Araştırma notlarını birleştir",
      status: "planned",
      priority: "low",
      tags: [{ id: "tag-work", name: "İş", color: "work" }],
      estimatedMinutes: 60,
      checklist: [],
      date: tomorrow,
      dueDate: tomorrow,
      scheduledDate: tomorrow,
      recurrence: "none",
      createdAt: stamp,
      updatedAt: stamp,
      order: 2,
    },
    {
      id: "demo-task-4",
      title: "Dünkü toplantı özetini gönder",
      status: "done",
      priority: "medium",
      tags: [{ id: "tag-meeting", name: "Toplantı", color: "meeting" }],
      checklist: [],
      date: yesterday,
      dueDate: yesterday,
      scheduledDate: yesterday,
      recurrence: "none",
      createdAt: stamp,
      updatedAt: stamp,
      completedAt: stamp,
      order: 3,
    },
  ];

  return {
    tasks,
    notes: [
      {
        id: "demo-day-note",
        date: today,
        content: "Bugünün niyeti\n\n• Sunumun ana fikrini berraklaştır\n• Öğleden sonra kısa bir yürüyüş yap\n\nNot: Her şeyi bitirmek değil, doğru şeyi ilerletmek.",
        plainText: "Bugünün niyeti\n\n• Sunumun ana fikrini berraklaştır\n• Öğleden sonra kısa bir yürüyüş yap\n\nNot: Her şeyi bitirmek değil, doğru şeyi ilerletmek.",
        updatedAt: stamp,
      },
    ],
    events: [
      {
        id: "demo-event-1",
        title: "Tasarım değerlendirmesi",
        description: "Mobil not akışı ve takvim etkileşimleri",
        date: today,
        startTime: "09:00",
        endTime: "10:00",
        tagColor: "meeting",
        isAllDay: false,
        recurrence: "none",
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: "demo-event-2",
        title: "Derin çalışma",
        date: today,
        startTime: "13:30",
        endTime: "15:00",
        tagColor: "project",
        isAllDay: false,
        recurrence: "none",
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: "demo-event-3",
        title: "Haftalık gözden geçirme",
        date: tomorrow,
        startTime: "17:00",
        endTime: "17:30",
        tagColor: "personal",
        isAllDay: false,
        recurrence: "weekly",
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    richNotes: [
      {
        id: "demo-rich-note",
        title: "Sonraki sürüm fikirleri",
        content: "- Haftalık enerji günlüğü\n- Takvimden doğrudan odak oturumu\n- Gün sonu üç soruluk değerlendirme",
        tags: ["ürün", "fikir"],
        pinned: true,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    workSessions: [
      {
        id: "demo-session-1",
        projectLabel: "Proje sunumu",
        durationMinutes: 25,
        phase: "work",
        completedAt: stamp,
        taskId: "demo-task-1",
      },
    ],
  };
}
