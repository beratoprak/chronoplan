/**
 * Faz 7 — Export Utilities
 * CSV for tasks, Markdown for notes, ICS for events
 */

import type { Task, DayNote, CalendarEvent } from "@/types";
import { getPriorityLabel, getStatusLabel, getTagColorLabel } from "./utils";

// ── CSV Export ─────────────────────────────────────────────

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportTasksToCSV(tasks: Task[]): void {
  const headers = [
    "Baslik",
    "Durum",
    "Oncelik",
    "Etiketler",
    "Tarih",
    "Tahmini Sure (dk)",
    "Checklist Tamamlanan",
    "Checklist Toplam",
    "Olusturulma",
    "Tamamlanma",
  ];

  const rows = tasks.map((t) => [
    escapeCsv(t.title),
    escapeCsv(getStatusLabel(t.status)),
    escapeCsv(getPriorityLabel(t.priority)),
    escapeCsv(t.tags.map((tag) => tag.name).join(", ")),
    t.date,
    String(t.estimatedMinutes || ""),
    String(t.checklist.filter((c) => c.completed).length),
    String(t.checklist.length),
    t.createdAt.split("T")[0],
    t.completedAt?.split("T")[0] || "",
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  downloadFile(csv, "chronoplan-gorevler.csv", "text/csv;charset=utf-8;");
}

// ── Markdown Export ────────────────────────────────────────

export function exportNotesToMarkdown(notes: DayNote[]): void {
  const sorted = [...notes].sort((a, b) => b.date.localeCompare(a.date));

  const md = sorted
    .map((note) => {
      return `## ${note.date}\n\n${note.plainText || "(Bos not)"}\n\n---\n`;
    })
    .join("\n");

  const content = `# ChronoPlan — Notlar\n\nExport tarihi: ${new Date().toLocaleDateString("tr-TR")}\n\n---\n\n${md}`;

  downloadFile(content, "chronoplan-notlar.md", "text/markdown;charset=utf-8;");
}

// ── ICS (iCalendar) Export ─────────────────────────────────

export function exportEventsToICS(events: CalendarEvent[]): void {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ChronoPlan//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    const dateClean = event.date.replace(/-/g, "");
    const startTime = event.startTime?.replace(":", "") || "0000";
    const endTime = event.endTime?.replace(":", "") || startTime;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@chronoplan`);
    lines.push(`SUMMARY:${event.title}`);

    if (event.isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateClean}`);
      lines.push(`DTEND;VALUE=DATE:${dateClean}`);
    } else {
      lines.push(`DTSTART:${dateClean}T${startTime}00`);
      lines.push(`DTEND:${dateClean}T${endTime}00`);
    }

    if (event.description) {
      lines.push(`DESCRIPTION:${event.description.replace(/\n/g, "\\n")}`);
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  downloadFile(lines.join("\r\n"), "chronoplan-etkinlikler.ics", "text/calendar;charset=utf-8;");
}

// ── Download Helper ────────────────────────────────────────

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob(["\ufeff" + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
